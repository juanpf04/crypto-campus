/**
 * badges.ts — Server Actions para el módulo de insignias (rediseñado).
 *
 * Modelo: SubjectBadge (1:1 con SubjectOffering) → Assignment → PrizeCategory[].
 * Las insignias son por asignatura. Las recompensas se canjean con insignias
 * de esa asignatura.
 *
 * Patrón de transacciones:
 * - Operaciones de PROFESSOR/ADMIN: firmadas por adminWalletClient.
 * - Operaciones de STUDENT: firmadas por la wallet custodial del alumno.
 */

"use server";

import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { getSession, ensureRole, logPrismaRecovery } from "@/lib/auth";
import { isContractPauseError, translateContractError } from "@/lib/contractErrors";
import { adminWalletClient, publicClient } from "@/lib/viem";
import { CONTRACT_ADDRESSES, BADGE_SYSTEM_ABI } from "@/lib/contracts";
import { hasRewardOfType, issueReward, ShopTokenRewardReason, type RewardGrant } from "@/lib/shopRewards";

// ── Helpers internos ─────────────────────────────────────────────────────

async function getUserWalletClient(userId: string) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { address: true, encryptedKey: true },
	});
	if (!user) throw new Error("Usuario no encontrado");
	const privateKey = decrypt(user.encryptedKey) as `0x${string}`;
	const account = privateKeyToAccount(privateKey);
	const walletClient = createWalletClient({ account, chain: hardhat, transport: http() });
	return { walletClient, address: user.address };
}

/**
 * Cierra automáticamente assignments cuyo deadline ya pasó si tienen autoClose=true.
 * Idempotente. Llamar antes de devolver datos al cliente.
 */
async function autoCloseExpiredAssignments(): Promise<void> {
	const now = new Date();
	await prisma.assignment.updateMany({
		where: {
			autoClose: true,
			status: "OPEN",
			deadline: { lte: now },
		},
		data: { status: "REVIEWING" },
	});
}

// ── SubjectBadge (insignia de asignatura) ────────────────────────────────

/**
 * Devuelve el SubjectBadge de una asignatura. Si no existe, lo crea on-chain
 * y en Prisma. Solo el profesor de la asignatura (o admin) puede invocarla.
 */
export async function getOrCreateSubjectBadge(subjectOfferingId: string) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const offering = await prisma.subjectOffering.findUnique({
		where: { id: subjectOfferingId },
		include: { subjectBadge: true },
	});
	if (!offering) throw new Error("Asignatura no encontrada");
	if (session.role !== "ADMIN" && offering.professorId !== session.userId)
		throw new Error("No autorizado");

	if (offering.subjectBadge) return offering.subjectBadge;

	// Leer next ID y crear on-chain
	const nextId = await publicClient.readContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "nextSubjectBadgeId",
	}) as bigint;
	const tokenId = Number(nextId);

	const hash = await adminWalletClient.writeContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "createSubjectBadge",
	});
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error("La transacción fue revertida");

	return prisma.subjectBadge.create({
		data: { tokenId, subjectOfferingId, txHash: hash },
	});
}

// ── Assignments ──────────────────────────────────────────────────────────

export interface PrizeCategoryInput {
	name: string;
	description?: string;
	badgeReward: number;
	maxWinners: number;
}

/**
 * Crea una assignment con sus PrizeCategories en cadena de transacciones:
 * 1. Si no hay SubjectBadge para la asignatura, lo crea on-chain + Prisma.
 * 2. Crea la Assignment on-chain → Prisma.
 * 3. Por cada premio, crea PrizeCategory on-chain → Prisma.
 */
export async function createAssignment(input: {
	subjectOfferingId: string;
	name: string;
	description?: string;
	deadline?: string | null;
	autoClose?: boolean;
	prizes: PrizeCategoryInput[];
}) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const name = input.name.trim();
	if (!name) throw new Error("El nombre es obligatorio");
	if (!input.prizes || input.prizes.length === 0)
		throw new Error("Debe incluir al menos un premio");

	for (const p of input.prizes) {
		if (!p.name.trim()) throw new Error("Cada premio necesita un nombre");
		if (!Number.isInteger(p.badgeReward) || p.badgeReward < 1)
			throw new Error("La recompensa de cada premio debe ser un entero >= 1");
		if (!Number.isInteger(p.maxWinners) || p.maxWinners < 1)
			throw new Error("El número máximo de ganadores debe ser un entero >= 1");
	}

	// 1. Asegurar SubjectBadge
	const badge = await getOrCreateSubjectBadge(input.subjectOfferingId);

	// 2. Crear Assignment on-chain
	const nextAssignmentId = await publicClient.readContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "nextAssignmentId",
	}) as bigint;
	const assignmentChainId = Number(nextAssignmentId);

	const assignmentHash = await adminWalletClient.writeContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "createAssignment",
		args: [BigInt(badge.tokenId)],
	});
	const assignmentReceipt = await publicClient.waitForTransactionReceipt({ hash: assignmentHash });
	if (assignmentReceipt.status !== "success") throw new Error("Error creando assignment on-chain");

	// 3. Crear cada PrizeCategory on-chain
	const prizeChainIds: number[] = [];
	const prizeTxHashes: string[] = [];

	for (const prize of input.prizes) {
		const nextPrizeId = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "nextPrizeCategoryId",
		}) as bigint;
		prizeChainIds.push(Number(nextPrizeId));

		const prizeHash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "addPrizeCategory",
			args: [BigInt(assignmentChainId), BigInt(prize.badgeReward), BigInt(prize.maxWinners)],
		});
		const prizeReceipt = await publicClient.waitForTransactionReceipt({ hash: prizeHash });
		if (prizeReceipt.status !== "success") throw new Error("Error creando premio on-chain");
		prizeTxHashes.push(prizeHash);
	}

	// 4. Persistir todo en Prisma en una transacción
	try {
		const assignment = await prisma.assignment.create({
			data: {
				assignmentId: assignmentChainId,
				name,
				description: input.description?.trim() || null,
				subjectBadgeId: badge.id,
				deadline: input.deadline ? new Date(input.deadline) : null,
				autoClose: input.autoClose ?? false,
				creatorId: session.userId!,
				txHash: assignmentHash,
				prizes: {
					create: input.prizes.map((prize, idx) => ({
						prizeCategoryId: prizeChainIds[idx],
						name: prize.name.trim(),
						description: prize.description?.trim() || null,
						badgeReward: prize.badgeReward,
						maxWinners: prize.maxWinners,
						txHash: prizeTxHashes[idx],
					})),
				},
			},
			include: { prizes: true },
		});
		return { success: true, assignment };
	} catch (e) {
		logPrismaRecovery(`createAssignment (assignmentChainId=${assignmentChainId}, prizeChainIds=${prizeChainIds.join(",")})`, assignmentHash, e);
		throw new Error("Assignment creada on-chain pero falló el guardado en BD. Revisa logs.");
	}
}

/**
 * Lista assignments del profesor logueado (o todas si admin).
 */
export async function listAssignmentsForProfessor(filters?: {
	subjectOfferingId?: string;
	professorId?: string;
}) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);
	await autoCloseExpiredAssignments();

	const where: Record<string, unknown> = {};

	// Profesores solo ven las suyas. Admin puede filtrar por profesor concreto.
	if (session.role === "ADMIN") {
		if (filters?.professorId) where.creatorId = filters.professorId;
	} else {
		where.creatorId = session.userId!;
	}

	if (filters?.subjectOfferingId) where.subjectBadge = { subjectOfferingId: filters.subjectOfferingId };

	return prisma.assignment.findMany({
		where,
		include: {
			subjectBadge: { include: { subjectOffering: { include: { subject: true, professor: { select: { id: true, name: true } } } } } },
			prizes: { include: { _count: { select: { awards: true } } } },
			_count: { select: { submissions: true } },
		},
		orderBy: { createdAt: "desc" },
	});
}

/**
 * Lista assignments para el alumno: solo de las asignaturas en las que está
 * matriculado, agrupadas por asignatura.
 */
export async function listAssignmentsForStudent() {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);
	await autoCloseExpiredAssignments();

	const enrollments = await prisma.enrollment.findMany({
		where: { userId: session.userId! },
		select: { subjectOfferingId: true },
	});
	const offeringIds = enrollments.map(e => e.subjectOfferingId);
	if (offeringIds.length === 0) return [];

	const assignments = await prisma.assignment.findMany({
		where: {
			subjectBadge: { subjectOfferingId: { in: offeringIds } },
		},
		include: {
			subjectBadge: { include: { subjectOffering: { include: { subject: true } } } },
			prizes: true,
			submissions: { where: { studentId: session.userId! }, take: 1 },
		},
		orderBy: { createdAt: "desc" },
	});

	return assignments.map(a => ({
		...a,
		hasSubmitted: a.submissions.length > 0,
		submissions: undefined,
	}));
}

export async function getAssignment(assignmentPrismaId: string) {
	const session = await getSession();
	if (!session.userId) throw new Error("No autenticado");
	await autoCloseExpiredAssignments();

	const assignment = await prisma.assignment.findUnique({
		where: { id: assignmentPrismaId },
		include: {
			subjectBadge: { include: { subjectOffering: { include: { subject: true, professor: { select: { id: true, name: true } } } } } },
			prizes: { include: { awards: { include: { user: { select: { id: true, name: true, email: true } } } } } },
			submissions: { include: { student: { select: { id: true, name: true, email: true } } } },
			creator: { select: { id: true, name: true } },
		},
	});
	if (!assignment) throw new Error("Tarea no encontrada");

	// Verificar acceso
	const offeringId = assignment.subjectBadge.subjectOfferingId;
	if (session.role === "STUDENT") {
		const enrolled = await prisma.enrollment.findUnique({
			where: { userId_subjectOfferingId: { userId: session.userId, subjectOfferingId: offeringId } },
		});
		if (!enrolled) throw new Error("No autorizado");
	} else if (session.role === "PROFESSOR" && assignment.creatorId !== session.userId) {
		throw new Error("No autorizado");
	}

	return assignment;
}

/**
 * El alumno marca la assignment como entregada (simulación).
 */
export async function submitAssignment(assignmentPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);
	await autoCloseExpiredAssignments();

	const assignment = await prisma.assignment.findUnique({
		where: { id: assignmentPrismaId },
		include: { subjectBadge: true },
	});
	if (!assignment) throw new Error("Tarea no encontrada");
	if (assignment.status !== "OPEN") throw new Error("La tarea ya no admite entregas");

	const enrolled = await prisma.enrollment.findUnique({
		where: {
			userId_subjectOfferingId: {
				userId: session.userId!,
				subjectOfferingId: assignment.subjectBadge.subjectOfferingId,
			},
		},
	});
	if (!enrolled) throw new Error("No estás matriculado en esta asignatura");

	const submission = await prisma.taskSubmission.upsert({
		where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: session.userId! } },
		create: { assignmentId: assignment.id, studentId: session.userId! },
		update: {},
	});
	return { success: true, submission };
}

export async function closeAssignmentForReview(assignmentPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const assignment = await prisma.assignment.findUnique({ where: { id: assignmentPrismaId } });
	if (!assignment) throw new Error("Tarea no encontrada");
	if (session.role !== "ADMIN" && assignment.creatorId !== session.userId)
		throw new Error("No autorizado");
	if (assignment.status !== "OPEN") throw new Error("La tarea no está abierta");

	// Pre-flight: Assignment existe y está OPEN on-chain.
	// AssignmentStatus: None=0, Open=1, Reviewing=2, Closed=3
	const onChain = await publicClient.readContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "getAssignment",
		args: [BigInt(assignment.assignmentId)],
	}) as { subjectBadgeId: bigint; professor: `0x${string}`; status: number };

	if (onChain.professor === "0x0000000000000000000000000000000000000000") {
		throw new Error(
			`La tarea no existe on-chain (assignmentId=${assignment.assignmentId}). ` +
			`Puede haber drift entre la base de datos y la blockchain; reinicia con pnpm run db:reset y pnpm dev.`,
		);
	}
	if (onChain.status !== 1) {
		throw new Error("La tarea ya no está abierta on-chain");
	}

	const hash = await adminWalletClient.writeContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "closeAssignmentForReview",
		args: [BigInt(assignment.assignmentId)],
	});
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error("Error on-chain");

	return prisma.assignment.update({
		where: { id: assignment.id },
		data: { status: "REVIEWING" },
	});
}

export async function closeAssignment(assignmentPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const assignment = await prisma.assignment.findUnique({ where: { id: assignmentPrismaId } });
	if (!assignment) throw new Error("Tarea no encontrada");
	if (session.role !== "ADMIN" && assignment.creatorId !== session.userId)
		throw new Error("No autorizado");
	if (assignment.status === "CLOSED") throw new Error("La tarea ya está cerrada");

	// Pre-flight: Assignment existe y no está ya CLOSED on-chain.
	const onChain = await publicClient.readContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "getAssignment",
		args: [BigInt(assignment.assignmentId)],
	}) as { subjectBadgeId: bigint; professor: `0x${string}`; status: number };

	if (onChain.professor === "0x0000000000000000000000000000000000000000") {
		throw new Error(
			`La tarea no existe on-chain (assignmentId=${assignment.assignmentId}). ` +
			`Puede haber drift entre la base de datos y la blockchain; reinicia con pnpm run db:reset y pnpm dev.`,
		);
	}
	if (onChain.status === 3) {
		throw new Error("La tarea ya está cerrada on-chain");
	}

	const hash = await adminWalletClient.writeContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "closeAssignment",
		args: [BigInt(assignment.assignmentId)],
	});
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error("Error on-chain");

	return prisma.assignment.update({
		where: { id: assignment.id },
		data: { status: "CLOSED", closedAt: new Date() },
	});
}

// ── Premios (otorgar) ────────────────────────────────────────────────────

/**
 * Otorga un premio a una lista de alumnos en una sola tx on-chain.
 */
export async function awardPrize(prizeCategoryPrismaId: string, studentUserIds: string[]) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	if (!Array.isArray(studentUserIds) || studentUserIds.length === 0)
		throw new Error("Debes seleccionar al menos un alumno");

	const prize = await prisma.prizeCategory.findUnique({
		where: { id: prizeCategoryPrismaId },
		include: {
			assignment: { include: { subjectBadge: true } },
			_count: { select: { awards: true } },
		},
	});
	if (!prize) throw new Error("Premio no encontrado");
	const assignment = prize.assignment;
	if (session.role !== "ADMIN" && assignment.creatorId !== session.userId)
		throw new Error("No autorizado");
	if (assignment.status === "CLOSED") throw new Error("La tarea ya está cerrada");

	if (prize._count.awards + studentUserIds.length > prize.maxWinners)
		throw new Error(`Solo quedan ${prize.maxWinners - prize._count.awards} ganadores disponibles`);

	// Obtener wallets de los alumnos
	const students = await prisma.user.findMany({
		where: { id: { in: studentUserIds }, role: "STUDENT" },
		select: { id: true, address: true },
	});
	if (students.length !== studentUserIds.length)
		throw new Error("Algún alumno no es válido");

	// Verificar que no estén ya premiados en esta categoría
	const existing = await prisma.badgeAward.findMany({
		where: {
			prizeCategoryId: prize.id,
			userId: { in: studentUserIds },
		},
		select: { userId: true },
	});
	if (existing.length > 0)
		throw new Error("Algún alumno ya ha sido premiado en esta categoría");

	// Pre-flight: verifica que la PrizeCategory existe on-chain y tiene cupo.
	// Protege de condiciones de carrera (otra tx la agotó) y del drift dev
	// cuando Hardhat se reinicia en local.
	const onChainPrize = await publicClient.readContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "getPrizeCategory",
		args: [BigInt(prize.prizeCategoryId)],
	}) as {
		assignmentId: bigint;
		badgeReward: bigint;
		maxWinners: bigint;
		currentWinners: bigint;
	};

	if (onChainPrize.assignmentId === BigInt(0)) {
		throw new Error(
			`El premio no existe on-chain (prizeCategoryId=${prize.prizeCategoryId}). ` +
			`Puede haber drift entre la base de datos y la blockchain; reinicia con pnpm run db:reset y pnpm dev para resincronizar.`,
		);
	}
	const available = Number(onChainPrize.maxWinners - onChainPrize.currentWinners);
	if (students.length > available) {
		throw new Error(`Solo quedan ${available} ganadores disponibles on-chain`);
	}

	// Llamar al contrato
	const hash = await adminWalletClient.writeContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "awardPrize",
		args: [BigInt(prize.prizeCategoryId), students.map(s => s.address as `0x${string}`)],
	});
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error("Error on-chain otorgando premio");

	// Crear los BadgeAward en Prisma
	try {
		await prisma.badgeAward.createMany({
			data: students.map(s => ({
				userId: s.id,
				prizeCategoryId: prize.id,
				subjectBadgeId: assignment.subjectBadgeId,
				awardedById: session.userId!,
				txHash: hash,
			})),
		});
	} catch (e) {
		logPrismaRecovery(`awardPrize (prizeId=${prize.id}, students=${studentUserIds.join(",")})`, hash, e);
		throw new Error("Premio otorgado on-chain pero falló el log en BD");
	}

	// ── Recompensa por insignia recibida ────────────────────────────────────
	// Sin first-use aquí: el bonus de primer uso del módulo se concede al
	// canjear una insignia (acción del estudiante). No se notifica al
	// estudiante porque esta acción la dispara el profesor.
	await Promise.all(students.map(student =>
		issueReward({
			userId: student.id,
			userAddress: student.address,
			mainReason: ShopTokenRewardReason.BADGE_AWARDED,
		}),
	));

	return { success: true, awarded: students.length };
}

// ── Recompensas ──────────────────────────────────────────────────────────

export async function createReward(input: {
	subjectOfferingId: string;
	name: string;
	description?: string;
	badgeCost: number;
	supply: number;
	category?: "TIEMPO" | "EXAMEN" | "PRACTICA" | "CONSULTA" | "OTROS";
}) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const name = input.name.trim();
	if (!name) throw new Error("El nombre es obligatorio");
	if (!Number.isInteger(input.badgeCost) || input.badgeCost < 1)
		throw new Error("El coste en insignias debe ser >= 1");
	if (!Number.isInteger(input.supply) || input.supply < 0)
		throw new Error("El stock debe ser >= 0 (0 = ilimitado)");

	const validCategories = ["TIEMPO", "EXAMEN", "PRACTICA", "CONSULTA", "OTROS"] as const;
	const category = input.category && validCategories.includes(input.category)
		? input.category
		: "OTROS";

	const badge = await getOrCreateSubjectBadge(input.subjectOfferingId);

	const nextId = await publicClient.readContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "nextRewardId",
	}) as bigint;
	const rewardChainId = Number(nextId);

	const hash = await adminWalletClient.writeContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "createReward",
		args: [BigInt(badge.tokenId), BigInt(input.badgeCost), BigInt(input.supply)],
	});
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error("Error on-chain creando recompensa");

	const reward = await prisma.reward.create({
		data: {
			rewardId: rewardChainId,
			name,
			description: input.description?.trim() || null,
			subjectBadgeId: badge.id,
			badgeCost: input.badgeCost,
			supply: input.supply,
			category,
			creatorId: session.userId!,
			txHash: hash,
		},
	});
	return { success: true, reward };
}

export async function deactivateReward(rewardPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const reward = await prisma.reward.findUnique({ where: { id: rewardPrismaId } });
	if (!reward) throw new Error("Recompensa no encontrada");
	if (session.role !== "ADMIN" && reward.creatorId !== session.userId)
		throw new Error("No autorizado");

	// Pre-flight: reward existe y está activa on-chain.
	const onChain = await publicClient.readContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "getReward",
		args: [BigInt(reward.rewardId)],
	}) as {
		subjectBadgeId: bigint;
		badgeCost: bigint;
		supply: bigint;
		totalSupply: bigint;
		professor: `0x${string}`;
		active: boolean;
	};

	if (onChain.professor === "0x0000000000000000000000000000000000000000") {
		throw new Error(
			`La recompensa no existe on-chain (rewardId=${reward.rewardId}). ` +
			`Puede haber drift entre la base de datos y la blockchain; reinicia con pnpm run db:reset y pnpm dev.`,
		);
	}
	if (!onChain.active) {
		throw new Error("La recompensa ya está desactivada on-chain");
	}

	const hash = await adminWalletClient.writeContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "deactivateReward",
		args: [BigInt(reward.rewardId)],
	});
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error("Error on-chain");

	return prisma.reward.update({
		where: { id: reward.id },
		data: { active: false },
	});
}

export async function listRewards(filters?: {
	subjectOfferingId?: string;
	professorId?: string;
}) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const where: Record<string, unknown> = {};

	if (session.role === "ADMIN") {
		if (filters?.professorId) where.creatorId = filters.professorId;
	} else {
		where.creatorId = session.userId!;
	}

	if (filters?.subjectOfferingId) where.subjectBadge = { subjectOfferingId: filters.subjectOfferingId };

	return prisma.reward.findMany({
		where,
		include: {
			subjectBadge: { include: { subjectOffering: { include: { subject: true, professor: { select: { id: true, name: true } } } } } },
			_count: { select: { redemptions: true } },
		},
		orderBy: { createdAt: "desc" },
	});
}

/**
 * Lista recompensas disponibles para canjear (alumno): solo activas, agrupadas
 * por asignatura matriculada.
 */
/**
 * Recompensas activas disponibles para el alumno.
 * Si se pasa `subjectOfferingId`, filtra a esa asignatura (el alumno debe estar matriculado).
 * Si no se pasa, devuelve las de TODAS sus asignaturas matriculadas.
 */
export async function listAvailableRewards(subjectOfferingId?: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	const enrollments = await prisma.enrollment.findMany({
		where: { userId: session.userId! },
		select: { subjectOfferingId: true },
	});
	const offeringIds = enrollments.map(e => e.subjectOfferingId);
	if (offeringIds.length === 0) return [];

	if (subjectOfferingId) {
		if (!offeringIds.includes(subjectOfferingId)) {
			throw new Error("No estás matriculado en esta asignatura");
		}
	}

	const filterOfferingIds = subjectOfferingId ? [subjectOfferingId] : offeringIds;

	return prisma.reward.findMany({
		where: {
			active: true,
			subjectBadge: { subjectOfferingId: { in: filterOfferingIds } },
		},
		include: {
			subjectBadge: { include: { subjectOffering: { include: { subject: true } } } },
			_count: { select: { redemptions: true } },
		},
		orderBy: { createdAt: "desc" },
	});
}

// ── Canjeo (alumno) ──────────────────────────────────────────────────────

export async function redeemReward(rewardPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	const reward = await prisma.reward.findUnique({
		where: { id: rewardPrismaId },
		include: { subjectBadge: true },
	});
	if (!reward) throw new Error("Recompensa no encontrada");
	if (!reward.active) throw new Error("Recompensa desactivada");

	const user = await prisma.user.findUnique({
		where: { id: session.userId! },
		select: { address: true },
	});
	if (!user) throw new Error("Usuario no encontrado");

	// Pre-flight: leer estado on-chain para dar un error específico antes de
	// gastar gas. Esto cubre los casos comunes: reward inexistente/desactivado
	// on-chain, stock agotado, e insignias insuficientes (drift Prisma <-> chain).
	const [onChainReward, onChainBalance] = await Promise.all([
		publicClient.readContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "getReward",
			args: [BigInt(reward.rewardId)],
		}) as Promise<{
			subjectBadgeId: bigint;
			badgeCost: bigint;
			supply: bigint;
			totalSupply: bigint;
			professor: `0x${string}`;
			active: boolean;
		}>,
		publicClient.readContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "balanceOf",
			args: [user.address as `0x${string}`, BigInt(reward.subjectBadge.tokenId)],
		}) as Promise<bigint>,
	]);

	if (onChainReward.professor === "0x0000000000000000000000000000000000000000") {
		throw new Error(
			`La recompensa no existe on-chain (rewardId=${reward.rewardId}). Puede haber drift entre la base de datos y la blockchain — prueba a reiniciar con pnpm dev para regenerar todo.`,
		);
	}
	if (!onChainReward.active) {
		throw new Error("La recompensa está desactivada on-chain");
	}
	if (onChainReward.totalSupply > BigInt(0) && onChainReward.supply === BigInt(0)) {
		throw new Error("Esta recompensa se ha agotado");
	}

	const balance = Number(onChainBalance);
	if (balance < reward.badgeCost) {
		throw new Error(
			`Necesitas ${reward.badgeCost} insignias y solo tienes ${balance} en esta asignatura (balance on-chain). ` +
			`Si ves un número distinto en la web, puede haber drift entre la base de datos y la blockchain — reinicia con pnpm dev.`,
		);
	}

	const { walletClient } = await getUserWalletClient(session.userId!);

	const hash = await walletClient.writeContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "redeemReward",
		args: [BigInt(reward.rewardId)],
	});
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error("La transacción fue revertida");

	await prisma.rewardRedemption.create({
		data: { userId: session.userId!, rewardId: reward.id, txHash: hash },
	});
	if (reward.supply > 0) {
		await prisma.reward.update({
			where: { id: reward.id },
			data: { supply: { decrement: 1 } },
		});
	}

	// Bonus primer uso del módulo Insignias
	let rewards: RewardGrant[] = [];
	const alreadyHad = await hasRewardOfType(
		session.userId!,
		ShopTokenRewardReason.MODULE_FIRST_USE_BADGES,
	);
	if (!alreadyHad) {
		rewards = await issueReward({
			userId: session.userId!,
			userAddress: user.address,
			mainReason: ShopTokenRewardReason.MODULE_FIRST_USE_BADGES,
		});
	}

	return { success: true, rewards };
}

/**
 * Devuelve las recompensas canjeadas por el alumno, AGREGADAS por recompensa.
 * Cada entrada incluye:
 *   - metadata de la recompensa (nombre, descripción, categoría, etc.)
 *   - redemptions: número total de veces canjeada
 *   - pending:  solicitudes de uso PENDING
 *   - approved: solicitudes de uso APPROVED (= tokens quemados)
 *   - available: tokens aún utilizables = redemptions − approved − pending
 *
 * Si se pasa `subjectOfferingId`, filtra a esa asignatura.
 */
export async function getMyRewardsWithState(subjectOfferingId?: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	if (subjectOfferingId) {
		const enrolled = await prisma.enrollment.findUnique({
			where: { userId_subjectOfferingId: { userId: session.userId!, subjectOfferingId } },
		});
		if (!enrolled) throw new Error("No estás matriculado en esta asignatura");
	}

	const offeringFilter = subjectOfferingId
		? { reward: { subjectBadge: { subjectOfferingId } } }
		: {};

	// Todos los canjes del alumno (opcionalmente filtrados por asignatura)
	const redemptions = await prisma.rewardRedemption.findMany({
		where: {
			userId: session.userId!,
			...offeringFilter,
		},
		include: {
			reward: {
				include: {
					subjectBadge: { include: { subjectOffering: { include: { subject: true } } } },
				},
			},
		},
		orderBy: { redeemedAt: "desc" },
	});

	// Todas las solicitudes de uso del alumno (misma filtración)
	const requests = await prisma.useRequest.findMany({
		where: {
			studentId: session.userId!,
			...offeringFilter,
		},
		select: { rewardId: true, status: true },
	});

	type Agg = {
		rewardId: string;
		rewardName: string;
		description: string | null;
		category: string;
		badgeCost: number;
		subjectName: string;
		subjectCode: string;
		group: string;
		redemptions: number;
		pending: number;
		approved: number;
		available: number;
		lastRedeemedAt: Date;
	};
	const map = new Map<string, Agg>();

	for (const r of redemptions) {
		const key = r.rewardId;
		const existing = map.get(key);
		if (existing) {
			existing.redemptions += 1;
			if (r.redeemedAt > existing.lastRedeemedAt) existing.lastRedeemedAt = r.redeemedAt;
		} else {
			map.set(key, {
				rewardId: r.rewardId,
				rewardName: r.reward.name,
				description: r.reward.description,
				category: r.reward.category,
				badgeCost: r.reward.badgeCost,
				subjectName: r.reward.subjectBadge.subjectOffering.subject.name,
				subjectCode: r.reward.subjectBadge.subjectOffering.subject.code,
				group: r.reward.subjectBadge.subjectOffering.group,
				redemptions: 1,
				pending: 0,
				approved: 0,
				available: 0,
				lastRedeemedAt: r.redeemedAt,
			});
		}
	}

	for (const req of requests) {
		const entry = map.get(req.rewardId);
		if (!entry) continue;
		if (req.status === "PENDING") entry.pending += 1;
		else if (req.status === "APPROVED") entry.approved += 1;
	}

	for (const entry of map.values()) {
		entry.available = entry.redemptions - entry.approved - entry.pending;
		if (entry.available < 0) entry.available = 0;
	}

	// Orden: con disponibles > con pendientes > solo usadas; dentro, más reciente primero
	return [...map.values()].sort((a, b) => {
		const aTier = a.available > 0 ? 0 : a.pending > 0 ? 1 : 2;
		const bTier = b.available > 0 ? 0 : b.pending > 0 ? 1 : 2;
		if (aTier !== bTier) return aTier - bTier;
		return b.lastRedeemedAt.getTime() - a.lastRedeemedAt.getTime();
	});
}

/**
 * Inventario de recompensas AGREGADO por alumno para una asignatura concreta.
 * Devuelve una fila por cada alumno matriculado en el offering; dentro, la
 * lista de recompensas canjeadas con los contadores agregados.
 *
 * Uso: vistas admin/profesor que muestran qué recompensas tiene cada alumno
 * en su grupo.
 *
 * - PROFESOR: solo si es titular del offering.
 * - ADMIN: cualquier offering.
 */
export async function getOfferingRewardsInventory(offeringId: string) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const offering = await prisma.subjectOffering.findUnique({
		where: { id: offeringId },
		include: { subject: true, subjectBadge: true },
	});
	if (!offering) throw new Error("Asignatura no encontrada");

	if (session.role !== "ADMIN" && offering.professorId !== session.userId) {
		throw new Error("No autorizado");
	}

	const enrollments = await prisma.enrollment.findMany({
		where: { subjectOfferingId: offeringId },
		include: { user: { select: { id: true, name: true, email: true } } },
		orderBy: { user: { name: "asc" } },
	});

	if (enrollments.length === 0) {
		return {
			offering: {
				id: offering.id,
				subjectName: offering.subject.name,
				subjectCode: offering.subject.code,
				group: offering.group,
				academicYear: offering.academicYear,
			},
			students: [],
		};
	}

	const userIds = enrollments.map((e) => e.userId);

	// Redemptions + use requests del offering, en una sola pasada
	const [redemptions, requests] = await Promise.all([
		prisma.rewardRedemption.findMany({
			where: {
				userId: { in: userIds },
				reward: { subjectBadge: { subjectOfferingId: offeringId } },
			},
			include: {
				reward: {
					select: { id: true, name: true, description: true, category: true, badgeCost: true },
				},
			},
			orderBy: { redeemedAt: "desc" },
		}),
		prisma.useRequest.findMany({
			where: {
				studentId: { in: userIds },
				reward: { subjectBadge: { subjectOfferingId: offeringId } },
			},
			select: { studentId: true, rewardId: true, status: true },
		}),
	]);

	type RewardAgg = {
		rewardId: string;
		rewardName: string;
		description: string | null;
		category: string;
		badgeCost: number;
		redemptions: number;
		pending: number;
		approved: number;
		available: number;
		lastRedeemedAt: Date;
	};

	// Mapa [userId][rewardId] → agregado
	const perStudent = new Map<string, Map<string, RewardAgg>>();

	for (const r of redemptions) {
		const byReward = perStudent.get(r.userId) ?? new Map<string, RewardAgg>();
		const existing = byReward.get(r.rewardId);
		if (existing) {
			existing.redemptions += 1;
			if (r.redeemedAt > existing.lastRedeemedAt) existing.lastRedeemedAt = r.redeemedAt;
		} else {
			byReward.set(r.rewardId, {
				rewardId: r.rewardId,
				rewardName: r.reward.name,
				description: r.reward.description,
				category: r.reward.category,
				badgeCost: r.reward.badgeCost,
				redemptions: 1,
				pending: 0,
				approved: 0,
				available: 0,
				lastRedeemedAt: r.redeemedAt,
			});
		}
		perStudent.set(r.userId, byReward);
	}

	for (const req of requests) {
		const byReward = perStudent.get(req.studentId);
		const entry = byReward?.get(req.rewardId);
		if (!entry) continue;
		if (req.status === "PENDING") entry.pending += 1;
		else if (req.status === "APPROVED") entry.approved += 1;
	}

	// Fila por alumno matriculado (aunque no tenga recompensas)
	return {
		offering: {
			id: offering.id,
			subjectName: offering.subject.name,
			subjectCode: offering.subject.code,
			group: offering.group,
			academicYear: offering.academicYear,
		},
		students: enrollments.map((e) => {
			const byReward = perStudent.get(e.userId);
			const rewards = byReward ? [...byReward.values()] : [];
			let totalRedemptions = 0;
			let totalAvailable = 0;
			let totalPending = 0;
			for (const r of rewards) {
				r.available = r.redemptions - r.approved - r.pending;
				if (r.available < 0) r.available = 0;
				totalRedemptions += r.redemptions;
				totalAvailable += r.available;
				totalPending += r.pending;
			}
			rewards.sort((a, b) => {
				const aTier = a.available > 0 ? 0 : a.pending > 0 ? 1 : 2;
				const bTier = b.available > 0 ? 0 : b.pending > 0 ? 1 : 2;
				if (aTier !== bTier) return aTier - bTier;
				return b.lastRedeemedAt.getTime() - a.lastRedeemedAt.getTime();
			});
			return {
				userId: e.user.id,
				name: e.user.name,
				email: e.user.email,
				totalRedemptions,
				totalAvailable,
				totalPending,
				rewards,
			};
		}),
	};
}

/**
 * Inventario GLOBAL de recompensas canjeadas por todos los alumnos del sistema.
 * Devuelve solo alumnos con al menos un canje. Cada reward incluye info del
 * offering al que pertenece (asignatura, grupo, profesor) para permitir
 * filtros client-side por alumno / asignatura / profesor / grupo.
 *
 * Acceso: ADMIN.
 */
export async function getAllRewardsInventory() {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	const students = await prisma.user.findMany({
		where: { role: "STUDENT" },
		select: { id: true, name: true, email: true },
		orderBy: { name: "asc" },
	});
	if (students.length === 0) return { students: [] };

	const userIds = students.map((s) => s.id);

	const [redemptions, requests] = await Promise.all([
		prisma.rewardRedemption.findMany({
			where: { userId: { in: userIds } },
			include: {
				reward: {
					select: {
						id: true,
						name: true,
						description: true,
						category: true,
						badgeCost: true,
						subjectBadge: {
							select: {
								subjectOffering: {
									select: {
										id: true,
										group: true,
										academicYear: true,
										subject: { select: { code: true, name: true } },
										professor: { select: { id: true, name: true } },
									},
								},
							},
						},
					},
				},
			},
			orderBy: { redeemedAt: "desc" },
		}),
		prisma.useRequest.findMany({
			where: { studentId: { in: userIds } },
			select: { studentId: true, rewardId: true, status: true },
		}),
	]);

	type RewardAgg = {
		rewardId: string;
		rewardName: string;
		description: string | null;
		category: string;
		badgeCost: number;
		redemptions: number;
		pending: number;
		approved: number;
		available: number;
		lastRedeemedAt: Date;
		offeringId: string;
		subjectCode: string;
		subjectName: string;
		group: string;
		academicYear: string;
		professorId: string;
		professorName: string;
	};

	const perStudent = new Map<string, Map<string, RewardAgg>>();

	for (const r of redemptions) {
		const offering = r.reward.subjectBadge.subjectOffering;
		const byReward = perStudent.get(r.userId) ?? new Map<string, RewardAgg>();
		const existing = byReward.get(r.rewardId);
		if (existing) {
			existing.redemptions += 1;
			if (r.redeemedAt > existing.lastRedeemedAt) existing.lastRedeemedAt = r.redeemedAt;
		} else {
			byReward.set(r.rewardId, {
				rewardId: r.rewardId,
				rewardName: r.reward.name,
				description: r.reward.description,
				category: r.reward.category,
				badgeCost: r.reward.badgeCost,
				redemptions: 1,
				pending: 0,
				approved: 0,
				available: 0,
				lastRedeemedAt: r.redeemedAt,
				offeringId: offering.id,
				subjectCode: offering.subject.code,
				subjectName: offering.subject.name,
				group: offering.group,
				academicYear: offering.academicYear,
				professorId: offering.professor.id,
				professorName: offering.professor.name,
			});
		}
		perStudent.set(r.userId, byReward);
	}

	for (const req of requests) {
		const byReward = perStudent.get(req.studentId);
		const entry = byReward?.get(req.rewardId);
		if (!entry) continue;
		if (req.status === "PENDING") entry.pending += 1;
		else if (req.status === "APPROVED") entry.approved += 1;
	}

	const result = students
		.filter((s) => perStudent.has(s.id))
		.map((s) => {
			const rewards = [...perStudent.get(s.id)!.values()];
			let totalRedemptions = 0;
			let totalAvailable = 0;
			let totalPending = 0;
			for (const r of rewards) {
				r.available = r.redemptions - r.approved - r.pending;
				if (r.available < 0) r.available = 0;
				totalRedemptions += r.redemptions;
				totalAvailable += r.available;
				totalPending += r.pending;
			}
			rewards.sort((a, b) => {
				const aTier = a.available > 0 ? 0 : a.pending > 0 ? 1 : 2;
				const bTier = b.available > 0 ? 0 : b.pending > 0 ? 1 : 2;
				if (aTier !== bTier) return aTier - bTier;
				return b.lastRedeemedAt.getTime() - a.lastRedeemedAt.getTime();
			});
			return {
				userId: s.id,
				name: s.name,
				email: s.email,
				totalRedemptions,
				totalAvailable,
				totalPending,
				rewards,
			};
		});

	return { students: result };
}

// ── Solicitudes de uso ───────────────────────────────────────────────────

export async function requestUseReward(rewardPrismaId: string) {
	try {
		return await _requestUseRewardImpl(rewardPrismaId);
	} catch (error) {
		if (isContractPauseError(error)) throw translateContractError(error, "Insignias");
		throw error;
	}
}

async function _requestUseRewardImpl(rewardPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	const reward = await prisma.reward.findUnique({ where: { id: rewardPrismaId } });
	if (!reward) throw new Error("Recompensa no encontrada");

	const user = await prisma.user.findUnique({
		where: { id: session.userId! },
		select: { address: true },
	});
	if (!user) throw new Error("Usuario no encontrado");

	// Pre-flight: reward existe on-chain y el alumno posee al menos 1 token
	// de esa recompensa (canjes sin solicitud de uso activa).
	const rewardTokenId = await publicClient.readContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "getRewardTokenId",
		args: [BigInt(reward.rewardId)],
	}) as bigint;

	const [onChainReward, tokenBalance] = await Promise.all([
		publicClient.readContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "getReward",
			args: [BigInt(reward.rewardId)],
		}) as Promise<{ professor: `0x${string}`; active: boolean }>,
		publicClient.readContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "balanceOf",
			args: [user.address as `0x${string}`, rewardTokenId],
		}) as Promise<bigint>,
	]);

	if (onChainReward.professor === "0x0000000000000000000000000000000000000000") {
		throw new Error(
			`La recompensa no existe on-chain (rewardId=${reward.rewardId}). ` +
			`Puede haber drift entre la base de datos y la blockchain; reinicia con pnpm run db:reset y pnpm dev.`,
		);
	}
	if (tokenBalance === BigInt(0)) {
		throw new Error("No tienes ningún token de esta recompensa disponible para usar");
	}

	const nextId = await publicClient.readContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "nextUseRequestId",
	}) as bigint;
	const requestId = Number(nextId);

	const { walletClient } = await getUserWalletClient(session.userId!);
	const hash = await walletClient.writeContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "requestUseReward",
		args: [BigInt(reward.rewardId)],
	});
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error("La transacción fue revertida");

	await prisma.useRequest.create({
		data: {
			requestId,
			studentId: session.userId!,
			rewardId: reward.id,
			status: "PENDING",
			txHash: hash,
		},
	});
	return { success: true };
}

/**
 * Pre-flight común para cancel/approve/reject: verifica que la UseRequest
 * existe on-chain y que su estado es PENDING (1).
 * UseRequestStatus: None=0, Pending=1, Approved=2, Rejected=3, Cancelled=4
 */
async function assertUseRequestPendingOnChain(requestId: number): Promise<void> {
	const onChain = await publicClient.readContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "getUseRequest",
		args: [BigInt(requestId)],
	}) as { student: `0x${string}`; rewardId: bigint; status: number };

	if (onChain.student === "0x0000000000000000000000000000000000000000") {
		throw new Error(
			`La solicitud no existe on-chain (requestId=${requestId}). ` +
			`Puede haber drift entre la base de datos y la blockchain; reinicia con pnpm run db:reset y pnpm dev.`,
		);
	}
	if (onChain.status !== 1) {
		const labels: Record<number, string> = {
			2: "aprobada", 3: "rechazada", 4: "cancelada",
		};
		throw new Error(`La solicitud ya está ${labels[onChain.status] ?? "resuelta"} on-chain`);
	}
}

export async function cancelUseRequest(requestId: number) {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	await assertUseRequestPendingOnChain(requestId);

	const { walletClient } = await getUserWalletClient(session.userId!);
	const hash = await walletClient.writeContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "cancelUseRequest",
		args: [BigInt(requestId)],
	});
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error("La transacción fue revertida");

	await prisma.useRequest.update({ where: { requestId }, data: { status: "CANCELLED" } });
	return { success: true };
}

export async function approveUseRequest(requestId: number) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	await assertUseRequestPendingOnChain(requestId);

	const hash = await adminWalletClient.writeContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "approveUseRequest",
		args: [BigInt(requestId)],
	});
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error("Error on-chain");

	await prisma.useRequest.update({ where: { requestId }, data: { status: "APPROVED" } });
	return { success: true };
}

export async function rejectUseRequest(requestId: number) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	await assertUseRequestPendingOnChain(requestId);

	const hash = await adminWalletClient.writeContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "rejectUseRequest",
		args: [BigInt(requestId)],
	});
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error("Error on-chain");

	await prisma.useRequest.update({ where: { requestId }, data: { status: "REJECTED" } });
	return { success: true };
}

export async function getMyUseRequests(filters?: {
	subjectOfferingId?: string;
	status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
}) {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	if (filters?.subjectOfferingId) {
		const enrolled = await prisma.enrollment.findUnique({
			where: {
				userId_subjectOfferingId: {
					userId: session.userId!,
					subjectOfferingId: filters.subjectOfferingId,
				},
			},
		});
		if (!enrolled) throw new Error("No estás matriculado en esta asignatura");
	}

	return prisma.useRequest.findMany({
		where: {
			studentId: session.userId!,
			...(filters?.status ? { status: filters.status } : {}),
			...(filters?.subjectOfferingId
				? { reward: { subjectBadge: { subjectOfferingId: filters.subjectOfferingId } } }
				: {}),
		},
		include: {
			reward: { include: { subjectBadge: { include: { subjectOffering: { include: { subject: true } } } } } },
		},
		orderBy: { createdAt: "desc" },
	});
}

export async function listUseRequests(filters?: {
	subjectOfferingId?: string;
	professorId?: string;
	status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
}) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const where: Record<string, unknown> = {};
	const rewardFilters: Record<string, unknown> = {};

	if (session.role === "ADMIN") {
		if (filters?.professorId) rewardFilters.creatorId = filters.professorId;
	} else {
		rewardFilters.creatorId = session.userId!;
	}

	if (filters?.subjectOfferingId) {
		rewardFilters.subjectBadge = { subjectOfferingId: filters.subjectOfferingId };
	}

	if (Object.keys(rewardFilters).length > 0) where.reward = rewardFilters;
	if (filters?.status) where.status = filters.status;

	return prisma.useRequest.findMany({
		where,
		include: {
			student: { select: { id: true, name: true, email: true } },
			reward: {
				select: {
					id: true,
					name: true,
					category: true,
					subjectBadge: {
						include: {
							subjectOffering: {
								include: {
									subject: true,
									professor: { select: { id: true, name: true } },
								},
							},
						},
					},
				},
			},
		},
		orderBy: { createdAt: "desc" },
	});
}

// ── Insignias del alumno ─────────────────────────────────────────────────

/**
 * Devuelve TODAS las asignaturas en las que el alumno está matriculado,
 * con el balance ACTUAL de insignias (ganadas - canjeadas). Este es el valor
 * que el contrato BadgeSystem tiene on-chain vía balanceOf.
 * Usado en la vista principal /student/badges.
 */
export async function getMyEnrolledSubjects() {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	const enrollments = await prisma.enrollment.findMany({
		where: { userId: session.userId! },
		include: {
			subjectOffering: {
				include: {
					subject: true,
					subjectBadge: true,
				},
			},
		},
	});

	const subjectBadgeIds = enrollments
		.map(e => e.subjectOffering.subjectBadge?.id)
		.filter((v): v is string => Boolean(v));

	// Insignias ganadas por subjectBadge
	const awards = await prisma.badgeAward.findMany({
		where: {
			userId: session.userId!,
			subjectBadgeId: { in: subjectBadgeIds },
		},
		include: { prizeCategory: { select: { badgeReward: true } } },
	});
	const earnedBySubject = new Map<string, number>();
	for (const a of awards) {
		earnedBySubject.set(
			a.subjectBadgeId,
			(earnedBySubject.get(a.subjectBadgeId) ?? 0) + a.prizeCategory.badgeReward,
		);
	}

	// Insignias quemadas al canjear recompensas
	const redemptions = await prisma.rewardRedemption.findMany({
		where: {
			userId: session.userId!,
			reward: { subjectBadgeId: { in: subjectBadgeIds } },
		},
		include: { reward: { select: { subjectBadgeId: true, badgeCost: true } } },
	});
	const burnedBySubject = new Map<string, number>();
	for (const r of redemptions) {
		burnedBySubject.set(
			r.reward.subjectBadgeId,
			(burnedBySubject.get(r.reward.subjectBadgeId) ?? 0) + r.reward.badgeCost,
		);
	}

	return enrollments.map(e => {
		const sbId = e.subjectOffering.subjectBadge?.id;
		const earned = sbId ? earnedBySubject.get(sbId) ?? 0 : 0;
		const burned = sbId ? burnedBySubject.get(sbId) ?? 0 : 0;
		return {
			subjectOfferingId: e.subjectOffering.id,
			subjectBadgeId: sbId ?? null,
			subjectName: e.subjectOffering.subject.name,
			subjectCode: e.subjectOffering.subject.code,
			group: e.subjectOffering.group,
			academicYear: e.subjectOffering.academicYear,
			totalBadges: Math.max(0, earned - burned),
		};
	});
}

/**
 * Devuelve el desglose de insignias del alumno EN UNA asignatura concreta,
 * agrupadas por premio (PrizeCategory) — para la card superior de la vista de
 * recompensas filtradas por asignatura.
 */
export async function getSubjectBadgesBreakdown(subjectOfferingId: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	const enrolled = await prisma.enrollment.findUnique({
		where: { userId_subjectOfferingId: { userId: session.userId!, subjectOfferingId } },
	});
	if (!enrolled) throw new Error("No estás matriculado en esta asignatura");

	const offering = await prisma.subjectOffering.findUnique({
		where: { id: subjectOfferingId },
		include: { subject: true, subjectBadge: true },
	});
	if (!offering) throw new Error("Asignatura no encontrada");

	const awards = offering.subjectBadge
		? await prisma.badgeAward.findMany({
			where: {
				userId: session.userId!,
				subjectBadgeId: offering.subjectBadge.id,
			},
			include: {
				prizeCategory: { include: { assignment: { select: { id: true, name: true } } } },
			},
			orderBy: { awardedAt: "desc" },
		})
		: [];

	// Agrupa por tarea (assignment). Dentro de cada tarea, por premio (prizeCategory).
	type PrizeEntry = {
		prizeCategoryId: string;
		prizeName: string;
		badgeReward: number;
		timesWon: number;
		totalBadges: number;
	};
	type AssignmentGroup = {
		assignmentId: string;
		assignmentName: string;
		totalBadges: number;
		latestAwardedAt: Date;
		prizes: PrizeEntry[];
	};

	const groups = new Map<string, AssignmentGroup>();
	for (const a of awards) {
		const assignmentId = a.prizeCategory.assignment.id;
		let ag = groups.get(assignmentId);
		if (!ag) {
			ag = {
				assignmentId,
				assignmentName: a.prizeCategory.assignment.name,
				totalBadges: 0,
				latestAwardedAt: a.awardedAt,
				prizes: [],
			};
			groups.set(assignmentId, ag);
		}

		let prize = ag.prizes.find(p => p.prizeCategoryId === a.prizeCategoryId);
		if (!prize) {
			prize = {
				prizeCategoryId: a.prizeCategoryId,
				prizeName: a.prizeCategory.name,
				badgeReward: a.prizeCategory.badgeReward,
				timesWon: 0,
				totalBadges: 0,
			};
			ag.prizes.push(prize);
		}
		prize.timesWon += 1;
		prize.totalBadges += a.prizeCategory.badgeReward;
		ag.totalBadges += a.prizeCategory.badgeReward;
		if (a.awardedAt > ag.latestAwardedAt) ag.latestAwardedAt = a.awardedAt;
	}

	const breakdown = [...groups.values()].sort((a, b) => b.totalBadges - a.totalBadges);
	const earnedBadges = breakdown.reduce((acc, g) => acc + g.totalBadges, 0);

	// Insignias quemadas al canjear recompensas en esta asignatura
	const burnedBadges = offering.subjectBadge
		? (
			await prisma.rewardRedemption.findMany({
				where: {
					userId: session.userId!,
					reward: { subjectBadgeId: offering.subjectBadge.id },
				},
				include: { reward: { select: { badgeCost: true } } },
			})
		).reduce((acc, r) => acc + r.reward.badgeCost, 0)
		: 0;

	const currentBalance = Math.max(0, earnedBadges - burnedBadges);

	return {
		subjectOfferingId,
		subjectName: offering.subject.name,
		subjectCode: offering.subject.code,
		group: offering.group,
		academicYear: offering.academicYear,
		/** Balance actual (ganadas - canjeadas) — coincide con balanceOf on-chain */
		totalBadges: currentBalance,
		/** Total histórico de insignias ganadas en esta asignatura */
		earnedBadges,
		/** Total de insignias canjeadas por recompensas en esta asignatura */
		burnedBadges,
		breakdown,
	};
}

// ── Stats ────────────────────────────────────────────────────────────────

export async function getBadgeStats() {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);
	await autoCloseExpiredAssignments();

	const isAdmin = session.role === "ADMIN";
	const assignmentWhere = isAdmin ? {} : { creatorId: session.userId! };
	const prizeWhere = isAdmin ? {} : { assignment: { creatorId: session.userId! } };
	const awardWhere = isAdmin ? {} : { prizeCategory: { assignment: { creatorId: session.userId! } } };
	const rewardWhere = isAdmin ? {} : { creatorId: session.userId! };
	const useReqWhere = isAdmin ? {} : { reward: { creatorId: session.userId! } };

	const [
		totalAssignments, openAssignments, reviewingAssignments, closedAssignments,
		totalPrizes, totalAwards,
		totalRewards, totalRedemptions,
		pendingRequests, approvedRequests, rejectedRequests,
		totalSubjectBadges,
	] = await Promise.all([
		prisma.assignment.count({ where: assignmentWhere }),
		prisma.assignment.count({ where: { ...assignmentWhere, status: "OPEN" } }),
		prisma.assignment.count({ where: { ...assignmentWhere, status: "REVIEWING" } }),
		prisma.assignment.count({ where: { ...assignmentWhere, status: "CLOSED" } }),
		prisma.prizeCategory.count({ where: prizeWhere }),
		prisma.badgeAward.count({ where: awardWhere }),
		prisma.reward.count({ where: rewardWhere }),
		prisma.rewardRedemption.count({ where: { reward: rewardWhere } }),
		prisma.useRequest.count({ where: { ...useReqWhere, status: "PENDING" } }),
		prisma.useRequest.count({ where: { ...useReqWhere, status: "APPROVED" } }),
		prisma.useRequest.count({ where: { ...useReqWhere, status: "REJECTED" } }),
		isAdmin
			? prisma.subjectBadge.count()
			: prisma.subjectBadge.count({
				where: { subjectOffering: { professorId: session.userId! } },
			}),
	]);

	return {
		totalSubjectBadges,
		totalAssignments, openAssignments, reviewingAssignments, closedAssignments,
		totalPrizes, totalAwards,
		totalRewards, totalRedemptions,
		pendingRequests, approvedRequests, rejectedRequests,
	};
}

// ── Alumnos por asignatura (para selección de ganadores) ────────────────

/**
 * Devuelve los alumnos matriculados en la SubjectOffering de la assignment,
 * con flag de si entregaron, y si ya ganaron en cada premio.
 */
export async function getStudentsForAssignment(assignmentPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const assignment = await prisma.assignment.findUnique({
		where: { id: assignmentPrismaId },
		include: {
			subjectBadge: { include: { subjectOffering: { include: { subject: true } } } },
			prizes: { select: { id: true } },
			submissions: { select: { studentId: true, submittedAt: true } },
		},
	});
	if (!assignment) throw new Error("Tarea no encontrada");
	if (session.role !== "ADMIN" && assignment.creatorId !== session.userId)
		throw new Error("No autorizado");

	const enrollments = await prisma.enrollment.findMany({
		where: { subjectOfferingId: assignment.subjectBadge.subjectOfferingId },
		include: { user: { select: { id: true, name: true, email: true } } },
	});

	const submissionMap = new Map(assignment.submissions.map(s => [s.studentId, s.submittedAt]));

	const prizeIds = assignment.prizes.map(p => p.id);
	const awards = await prisma.badgeAward.findMany({
		where: { prizeCategoryId: { in: prizeIds } },
		select: { userId: true, prizeCategoryId: true },
	});
	// Agrupar premios ganados por alumno
	const awardedByStudent = new Map<string, Set<string>>();
	for (const a of awards) {
		const set = awardedByStudent.get(a.userId) ?? new Set<string>();
		set.add(a.prizeCategoryId);
		awardedByStudent.set(a.userId, set);
	}

	const students = enrollments.map(e => ({
		id: e.user.id,
		name: e.user.name,
		email: e.user.email,
		submitted: submissionMap.has(e.user.id),
		submittedAt: submissionMap.get(e.user.id) ?? null,
		awardedPrizeIds: [...(awardedByStudent.get(e.user.id) ?? [])],
	}));

	// Ordenar: entregados primero, luego no entregados
	students.sort((a, b) => {
		if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
		return a.name.localeCompare(b.name);
	});

	return {
		assignment: {
			id: assignment.id,
			name: assignment.name,
			status: assignment.status,
			subject: assignment.subjectBadge.subjectOffering.subject.name,
			group: assignment.subjectBadge.subjectOffering.group,
		},
		students,
	};
}

/**
 * Devuelve las SubjectOfferings que el profesor logueado imparte.
 * Útil para selectores al crear assignments y rewards.
 */
export async function getMySubjectOfferings() {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const where = session.role === "ADMIN" ? {} : { professorId: session.userId! };
	return prisma.subjectOffering.findMany({
		where,
		include: {
			subject: true,
			professor: { select: { id: true, name: true, email: true } },
			_count: { select: { enrollments: true } },
		},
		orderBy: [{ academicYear: "desc" }, { group: "asc" }],
	});
}

/**
 * Stats específicas de UNA asignatura impartida (SubjectOffering).
 * Usado en /professor/subjects/[offeringId] (vista Resumen).
 */
export async function getOfferingSummary(offeringId: string) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);
	await autoCloseExpiredAssignments();

	const offering = await prisma.subjectOffering.findUnique({
		where: { id: offeringId },
		include: {
			subject: true,
			professor: { select: { id: true, name: true, email: true } },
			subjectBadge: true,
			_count: { select: { enrollments: true } },
		},
	});
	if (!offering) throw new Error("Asignatura no encontrada");

	if (session.role !== "ADMIN" && offering.professorId !== session.userId) {
		throw new Error("No autorizado");
	}

	const assignmentWhere = { subjectBadge: { subjectOfferingId: offeringId } };
	const rewardWhere = { subjectBadge: { subjectOfferingId: offeringId } };
	const awardWhere = { subjectBadge: { subjectOfferingId: offeringId } };
	const useReqWhere = { reward: { subjectBadge: { subjectOfferingId: offeringId } } };

	const [
		totalAssignments, openAssignments, reviewingAssignments, closedAssignments,
		totalAwards,
		totalRewards, activeRewards, totalRedemptions,
		pendingRequests, approvedRequests,
	] = await Promise.all([
		prisma.assignment.count({ where: assignmentWhere }),
		prisma.assignment.count({ where: { ...assignmentWhere, status: "OPEN" } }),
		prisma.assignment.count({ where: { ...assignmentWhere, status: "REVIEWING" } }),
		prisma.assignment.count({ where: { ...assignmentWhere, status: "CLOSED" } }),
		prisma.badgeAward.count({ where: awardWhere }),
		prisma.reward.count({ where: rewardWhere }),
		prisma.reward.count({ where: { ...rewardWhere, active: true } }),
		prisma.rewardRedemption.count({ where: { reward: rewardWhere } }),
		prisma.useRequest.count({ where: { ...useReqWhere, status: "PENDING" } }),
		prisma.useRequest.count({ where: { ...useReqWhere, status: "APPROVED" } }),
	]);

	// Actividad reciente: últimas insignias otorgadas + últimas solicitudes
	const [recentAwards, recentRequests] = await Promise.all([
		prisma.badgeAward.findMany({
			where: awardWhere,
			include: {
				user: { select: { id: true, name: true } },
				prizeCategory: { select: { name: true, assignment: { select: { name: true } } } },
			},
			orderBy: { awardedAt: "desc" },
			take: 5,
		}),
		prisma.useRequest.findMany({
			where: useReqWhere,
			include: {
				student: { select: { id: true, name: true } },
				reward: { select: { name: true } },
			},
			orderBy: { createdAt: "desc" },
			take: 5,
		}),
	]);

	return {
		offering: {
			id: offering.id,
			group: offering.group,
			academicYear: offering.academicYear,
			subjectName: offering.subject.name,
			subjectCode: offering.subject.code,
			professor: offering.professor,
			hasSubjectBadge: offering.subjectBadge !== null,
			enrollmentCount: offering._count.enrollments,
		},
		stats: {
			assignments: {
				total: totalAssignments,
				open: openAssignments,
				reviewing: reviewingAssignments,
				closed: closedAssignments,
			},
			awardsGiven: totalAwards,
			rewards: { total: totalRewards, active: activeRewards },
			redemptions: totalRedemptions,
			requests: { pending: pendingRequests, approved: approvedRequests },
		},
		recentAwards,
		recentRequests,
	};
}

/**
 * Devuelve todas las tareas en estado REVIEWING, cross-subject.
 * - Profesor: solo las suyas.
 * - Admin: todas; puede filtrar por profesor y/o asignatura.
 * Usado en /professor/pending-reviews y /admin/pending-reviews.
 */
export async function getAssignmentsPendingReview(filters?: {
	subjectOfferingId?: string;
	professorId?: string;
}) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);
	await autoCloseExpiredAssignments();

	const where: Record<string, unknown> = { status: "REVIEWING" };

	if (session.role === "ADMIN") {
		if (filters?.professorId) where.creatorId = filters.professorId;
	} else {
		where.creatorId = session.userId!;
	}

	if (filters?.subjectOfferingId) {
		where.subjectBadge = { subjectOfferingId: filters.subjectOfferingId };
	}

	return prisma.assignment.findMany({
		where,
		include: {
			subjectBadge: { include: { subjectOffering: { include: { subject: true, professor: { select: { id: true, name: true } } } } } },
			prizes: { include: { _count: { select: { awards: true } } } },
			_count: { select: { submissions: true } },
		},
		orderBy: { createdAt: "desc" },
	});
}

/**
 * Alumnos matriculados en UNA asignatura impartida, con stats básicos:
 * entregas realizadas y total de insignias ganadas en esa asignatura.
 */
export async function getStudentsInOffering(offeringId: string) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const offering = await prisma.subjectOffering.findUnique({
		where: { id: offeringId },
		include: { subjectBadge: true },
	});
	if (!offering) throw new Error("Asignatura no encontrada");

	if (session.role !== "ADMIN" && offering.professorId !== session.userId) {
		throw new Error("No autorizado");
	}

	const enrollments = await prisma.enrollment.findMany({
		where: { subjectOfferingId: offeringId },
		include: {
			user: { select: { id: true, name: true, email: true } },
		},
		orderBy: { user: { name: "asc" } },
	});

	// Contar entregas por alumno en esta asignatura
	const submissions = await prisma.taskSubmission.findMany({
		where: {
			assignment: { subjectBadge: { subjectOfferingId: offeringId } },
			studentId: { in: enrollments.map(e => e.userId) },
		},
		select: { studentId: true },
	});
	const submissionsByStudent = new Map<string, number>();
	for (const s of submissions) {
		submissionsByStudent.set(s.studentId, (submissionsByStudent.get(s.studentId) ?? 0) + 1);
	}

	// Contar insignias ganadas por alumno en esta asignatura (lifetime)
	const awards = offering.subjectBadge
		? await prisma.badgeAward.findMany({
			where: {
				subjectBadgeId: offering.subjectBadge.id,
				userId: { in: enrollments.map(e => e.userId) },
			},
			include: { prizeCategory: { select: { badgeReward: true } } },
		})
		: [];
	const badgesByStudent = new Map<string, number>();
	for (const a of awards) {
		badgesByStudent.set(
			a.userId,
			(badgesByStudent.get(a.userId) ?? 0) + a.prizeCategory.badgeReward,
		);
	}

	return enrollments.map(e => ({
		enrollmentId: e.id,
		userId: e.user.id,
		name: e.user.name,
		email: e.user.email,
		submissions: submissionsByStudent.get(e.userId) ?? 0,
		badgesEarned: badgesByStudent.get(e.userId) ?? 0,
	}));
}

/**
 * Todos los alumnos matriculados en CUALQUIERA de las asignaturas del profesor.
 * Cada alumno incluye la lista de asignaturas que comparte con él (para fila
 * expandible en /professor/students).
 */
export async function getMyStudentsGlobal() {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const offeringsWhere = session.role === "ADMIN" ? {} : { professorId: session.userId! };
	const myOfferings = await prisma.subjectOffering.findMany({
		where: offeringsWhere,
		select: { id: true },
	});
	const offeringIds = myOfferings.map(o => o.id);
	if (offeringIds.length === 0) return [];

	const enrollments = await prisma.enrollment.findMany({
		where: { subjectOfferingId: { in: offeringIds } },
		include: {
			user: { select: { id: true, name: true, email: true } },
			subjectOffering: {
				include: { subject: true },
			},
		},
	});

	type StudentEntry = {
		userId: string;
		name: string;
		email: string;
		offerings: Array<{
			offeringId: string;
			subjectName: string;
			subjectCode: string;
			group: string;
			academicYear: string;
		}>;
	};

	const byStudent = new Map<string, StudentEntry>();
	for (const e of enrollments) {
		let entry = byStudent.get(e.userId);
		if (!entry) {
			entry = {
				userId: e.user.id,
				name: e.user.name,
				email: e.user.email,
				offerings: [],
			};
			byStudent.set(e.userId, entry);
		}
		entry.offerings.push({
			offeringId: e.subjectOffering.id,
			subjectName: e.subjectOffering.subject.name,
			subjectCode: e.subjectOffering.subject.code,
			group: e.subjectOffering.group,
			academicYear: e.subjectOffering.academicYear,
		});
	}

	return [...byStudent.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Para admin: TODOS los alumnos del sistema con TODAS sus matrículas
 * (no filtrado por asignaturas del profesor). Los alumnos sin matrículas
 * también aparecen.
 */
export async function getAllStudentsGlobal() {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	const students = await prisma.user.findMany({
		where: { role: "STUDENT" },
		select: {
			id: true,
			name: true,
			email: true,
			enrollments: {
				include: {
					subjectOffering: {
						include: {
							subject: true,
							professor: { select: { id: true, name: true } },
						},
					},
				},
			},
		},
		orderBy: { name: "asc" },
	});

	return students.map(s => ({
		userId: s.id,
		name: s.name,
		email: s.email,
		offerings: s.enrollments.map(e => ({
			enrollmentId: e.id,
			offeringId: e.subjectOffering.id,
			subjectName: e.subjectOffering.subject.name,
			subjectCode: e.subjectOffering.subject.code,
			group: e.subjectOffering.group,
			academicYear: e.subjectOffering.academicYear,
			professorName: e.subjectOffering.professor.name,
		})),
	}));
}

/**
 * Lista simple de profesores para rellenar dropdowns de filtro (admin).
 */
export async function listProfessors() {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	return prisma.user.findMany({
		where: { role: "PROFESSOR", active: true },
		select: { id: true, name: true, email: true },
		orderBy: { name: "asc" },
	});
}

// ── Estadísticas del profesor (dashboard personal) ──────────────────────

/**
 * Agrega datos para el dashboard personal del profesor logueado:
 * resumen numérico, alertas, series mensuales (6 meses), tops y actividad reciente.
 */
export async function getMyProfessorStats(): Promise<{
	// Resumen
	totalSubjectBadges: number;
	totalAssignments: number;
	openAssignments: number;
	reviewingAssignments: number;
	closedAssignments: number;
	totalAwards: number;
	totalRewards: number;
	pendingRequests: number;
	totalEnrolledStudents: number;

	// Alertas
	overdueAssignments: number;
	pendingSubmissionsReview: number;

	// Gráficos (6 meses, formato "abr 26")
	assignmentsByMonth: { month: string; count: number }[];
	awardsByMonth: { month: string; count: number }[];

	// Top lists
	topSubjectsByEnrollment: { subjectName: string; group: string; enrollmentCount: number }[];
	topAssignmentsBySubmissions: { assignmentName: string; subjectName: string; submissionCount: number; status: string }[];

	// Actividad reciente
	recentAwards: { studentName: string; prizeName: string; assignmentName: string; date: string }[];
	recentUseRequests: { studentName: string; rewardName: string; status: string; date: string }[];
}> {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR"]);
	const userId = session.userId!;

	await autoCloseExpiredAssignments();

	const now = new Date();
	const startMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);

	// ── 1. Resumen numérico ───────────────────────────────────────────────
	const [
		totalSubjectBadges,
		totalAssignments,
		openAssignments,
		reviewingAssignments,
		closedAssignments,
		totalAwards,
		totalRewards,
		pendingRequests,
		enrollmentAggregate,
		overdueAssignments,
		pendingSubmissionsReview,
	] = await Promise.all([
		prisma.subjectBadge.count({
			where: { subjectOffering: { professorId: userId } },
		}),
		prisma.assignment.count({ where: { creatorId: userId } }),
		prisma.assignment.count({ where: { creatorId: userId, status: "OPEN" } }),
		prisma.assignment.count({ where: { creatorId: userId, status: "REVIEWING" } }),
		prisma.assignment.count({ where: { creatorId: userId, status: "CLOSED" } }),
		prisma.badgeAward.count({ where: { awardedById: userId } }),
		prisma.reward.count({ where: { creatorId: userId } }),
		prisma.useRequest.count({
			where: { status: "PENDING", reward: { creatorId: userId } },
		}),
		prisma.enrollment.count({
			where: { subjectOffering: { professorId: userId } },
		}),
		prisma.assignment.count({
			where: { creatorId: userId, status: "OPEN", deadline: { lt: now } },
		}),
		prisma.taskSubmission.count({
			where: { assignment: { creatorId: userId, status: "REVIEWING" } },
		}),
	]);

	const totalEnrolledStudents = enrollmentAggregate;

	// ── 2. Series mensuales (6 meses) ─────────────────────────────────────
	const buildMonthlyBuckets = <T extends { createdAt?: Date; awardedAt?: Date }>(
		records: T[],
		dateField: "createdAt" | "awardedAt",
	) => {
		const buckets = new Map<string, number>();
		for (let i = 0; i < 6; i++) {
			const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
			buckets.set(key, 0);
		}
		for (const r of records) {
			const d = r[dateField] as Date;
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
			if (buckets.has(key)) buckets.set(key, buckets.get(key)! + 1);
		}
		return Array.from(buckets.entries()).map(([key, count]) => {
			const [year, month] = key.split("-");
			const d = new Date(Number(year), Number(month) - 1, 1);
			return {
				month: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
				count,
			};
		});
	};

	const [assignmentsRaw, awardsRaw] = await Promise.all([
		prisma.assignment.findMany({
			where: { creatorId: userId, createdAt: { gte: startMonth } },
			select: { createdAt: true },
		}),
		prisma.badgeAward.findMany({
			where: { awardedById: userId, awardedAt: { gte: startMonth } },
			select: { awardedAt: true },
		}),
	]);

	const assignmentsByMonth = buildMonthlyBuckets(assignmentsRaw, "createdAt");
	const awardsByMonth = buildMonthlyBuckets(awardsRaw, "awardedAt");

	// ── 3. Tops ───────────────────────────────────────────────────────────
	const topOfferings = await prisma.subjectOffering.findMany({
		where: { professorId: userId },
		include: { subject: true, _count: { select: { enrollments: true } } },
		orderBy: { enrollments: { _count: "desc" } },
		take: 5,
	});
	const topSubjectsByEnrollment = topOfferings.map(o => ({
		subjectName: o.subject.name,
		group: o.group,
		enrollmentCount: o._count.enrollments,
	}));

	const topAssignments = await prisma.assignment.findMany({
		where: { creatorId: userId },
		include: {
			_count: { select: { submissions: true } },
			subjectBadge: { include: { subjectOffering: { include: { subject: true } } } },
		},
		orderBy: { submissions: { _count: "desc" } },
		take: 5,
	});
	const topAssignmentsBySubmissions = topAssignments.map(a => ({
		assignmentName: a.name,
		subjectName: a.subjectBadge.subjectOffering.subject.name,
		submissionCount: a._count.submissions,
		status: a.status,
	}));

	// ── 4. Actividad reciente ─────────────────────────────────────────────
	const recentAwardsRaw = await prisma.badgeAward.findMany({
		where: { awardedById: userId },
		include: {
			user: { select: { name: true } },
			prizeCategory: {
				select: { name: true, assignment: { select: { name: true } } },
			},
		},
		orderBy: { awardedAt: "desc" },
		take: 5,
	});
	const recentAwards = recentAwardsRaw.map(a => ({
		studentName: a.user.name,
		prizeName: a.prizeCategory.name,
		assignmentName: a.prizeCategory.assignment.name,
		date: a.awardedAt.toISOString(),
	}));

	const recentUseRequestsRaw = await prisma.useRequest.findMany({
		where: { reward: { creatorId: userId } },
		include: {
			student: { select: { name: true } },
			reward: { select: { name: true } },
		},
		orderBy: { createdAt: "desc" },
		take: 5,
	});
	const recentUseRequests = recentUseRequestsRaw.map(r => ({
		studentName: r.student.name,
		rewardName: r.reward.name,
		status: r.status,
		date: r.createdAt.toISOString(),
	}));

	return {
		totalSubjectBadges,
		totalAssignments,
		openAssignments,
		reviewingAssignments,
		closedAssignments,
		totalAwards,
		totalRewards,
		pendingRequests,
		totalEnrolledStudents,
		overdueAssignments,
		pendingSubmissionsReview,
		assignmentsByMonth,
		awardsByMonth,
		topSubjectsByEnrollment,
		topAssignmentsBySubmissions,
		recentAwards,
		recentUseRequests,
	};
}

/**
 * Resumen de insignias del estudiante para el dashboard:
 * - earnedBadges: total de insignias ganadas (suma de badgeReward)
 * - availableAssignments: assignments OPEN donde el alumno no ha entregado
 * - pendingRedemptions: use requests pendientes del alumno
 * - recentAwards: últimas 5 insignias obtenidas con nombre del premio y asignatura
 */
export async function getMyBadgeSummary() {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	const userId = session.userId!;

	// Insignias ganadas
	const awards = await prisma.badgeAward.findMany({
		where: { userId },
		include: {
			prizeCategory: { select: { name: true, badgeReward: true } },
			subjectBadge: { include: { subjectOffering: { include: { subject: true } } } },
		},
		orderBy: { awardedAt: "desc" },
	});

	const earnedBadges = awards.reduce((sum, a) => sum + a.prizeCategory.badgeReward, 0);

	const recentAwards = awards.slice(0, 5).map((a) => ({
		prizeName: a.prizeCategory.name,
		badgeReward: a.prizeCategory.badgeReward,
		subjectName: a.subjectBadge.subjectOffering.subject.name,
		date: a.awardedAt.toISOString(),
	}));

	// Tareas disponibles: OPEN en asignaturas matriculadas donde no ha entregado
	const enrollments = await prisma.enrollment.findMany({
		where: { userId },
		select: { subjectOfferingId: true },
	});
	const offeringIds = enrollments.map((e) => e.subjectOfferingId);

	let availableAssignments = 0;
	if (offeringIds.length > 0) {
		const open = await prisma.assignment.findMany({
			where: {
				status: "OPEN",
				subjectBadge: { subjectOfferingId: { in: offeringIds } },
			},
			include: { submissions: { where: { studentId: userId }, take: 1 } },
		});
		availableAssignments = open.filter((a) => a.submissions.length === 0).length;
	}

	// Solicitudes de uso pendientes
	const pendingRedemptions = await prisma.useRequest.count({
		where: { studentId: userId, status: "PENDING" },
	});

	return {
		earnedBadges,
		availableAssignments,
		pendingRedemptions,
		recentAwards,
	};
}
