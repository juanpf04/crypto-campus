/**
 * badges.ts — Server Actions para el módulo de insignias.
 *
 * Gestiona tipos de badge, tareas, premios, recompensas y solicitudes de uso.
 * El contrato BadgeSystem es ERC-1155 soulbound (no transferible).
 *
 * Patrón de transacciones:
 * - Operaciones de PROFESSOR/ADMIN (crear tipos, tareas, recompensas, otorgar, aprobar/rechazar):
 *   firmadas por adminWalletClient (Account[0] de Hardhat).
 * - Operaciones de ESTUDIANTE (canjear recompensa, solicitar uso, cancelar):
 *   firmadas por la wallet custodial del estudiante.
 */

"use server";

import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { getSession, ensureRole, logPrismaRecovery } from "@/lib/action-utils";
import { adminWalletClient, publicClient } from "@/lib/viem";
import { CONTRACT_ADDRESSES, BADGE_SYSTEM_ABI } from "@/lib/contracts";

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

// ── Badge Types ──────────────────────────────────────────────────────────

export async function createBadgeType(input: {
	name: string;
	description?: string;
	subjectOfferingId: string;
}) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	try {
		const name = input.name.trim();
		if (!name) throw new Error("El nombre es obligatorio");

		const nextId = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "nextBadgeTypeId",
		}) as bigint;
		const tokenId = Number(nextId);

		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "createBadgeType",
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		const badgeType = await prisma.badgeType.create({
			data: {
				tokenId,
				name,
				description: input.description?.trim() || null,
				subjectOfferingId: input.subjectOfferingId,
				creatorId: session.userId!,
				txHash: hash,
			},
		});

		return { success: true, badgeType };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		throw new Error(`Error al crear tipo de insignia: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

export async function listBadgeTypes() {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const where = session.role === "ADMIN" ? {} : { creatorId: session.userId! };

	return prisma.badgeType.findMany({
		where,
		include: {
			subjectOffering: { include: { subject: true } },
			_count: { select: { tasks: true, awards: true } },
		},
		orderBy: { createdAt: "desc" },
	});
}

export async function getBadgeType(id: string) {
	const session = await getSession();
	if (!session.userId) throw new Error("No autenticado");

	const badgeType = await prisma.badgeType.findUnique({
		where: { id },
		include: {
			subjectOffering: { include: { subject: true, professor: { select: { name: true } } } },
			tasks: { orderBy: { createdAt: "desc" } },
			rewards: { orderBy: { createdAt: "desc" } },
			_count: { select: { awards: true } },
		},
	});
	if (!badgeType) throw new Error("Tipo de insignia no encontrado");
	return badgeType;
}

// ── Tasks ────────────────────────────────────────────────────────────────

export async function createTask(input: {
	name: string;
	description?: string;
	rewardAmount: number;
	badgeTypeId: string;
}) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	try {
		const name = input.name.trim();
		if (!name) throw new Error("El nombre es obligatorio");
		if (!Number.isInteger(input.rewardAmount) || input.rewardAmount < 0)
			throw new Error("La cantidad de reward debe ser un entero no negativo");

		const badgeType = await prisma.badgeType.findUnique({ where: { id: input.badgeTypeId } });
		if (!badgeType) throw new Error("Tipo de insignia no encontrado");

		const nextId = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "nextTaskId",
		}) as bigint;
		const taskId = Number(nextId);

		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "createTask",
			args: [BigInt(badgeType.tokenId), BigInt(input.rewardAmount)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		const task = await prisma.task.create({
			data: {
				taskId,
				name,
				description: input.description?.trim() || null,
				rewardAmount: input.rewardAmount,
				badgeTypeId: input.badgeTypeId,
				creatorId: session.userId!,
				txHash: hash,
			},
		});

		return { success: true, task };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		throw new Error(`Error al crear tarea: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

export async function deactivateTask(taskPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	try {
		const task = await prisma.task.findUnique({ where: { id: taskPrismaId } });
		if (!task) throw new Error("Tarea no encontrada");

		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "deactivateTask",
			args: [BigInt(task.taskId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		await prisma.task.update({ where: { id: taskPrismaId }, data: { active: false } });

		return { success: true };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		throw new Error(`Error al desactivar tarea: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

export async function listTasks(badgeTypeId?: string) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const where: Record<string, unknown> = {};
	if (badgeTypeId) where.badgeTypeId = badgeTypeId;
	if (session.role !== "ADMIN") where.creatorId = session.userId!;

	return prisma.task.findMany({
		where,
		include: {
			badgeType: { select: { name: true, tokenId: true } },
			_count: { select: { awards: true } },
		},
		orderBy: { createdAt: "desc" },
	});
}

// ── Awards ───────────────────────────────────────────────────────────────

export async function awardBadge(taskPrismaId: string, studentId: string) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	try {
		const task = await prisma.task.findUnique({
			where: { id: taskPrismaId },
			include: { badgeType: true },
		});
		if (!task) throw new Error("Tarea no encontrada");
		if (!task.active) throw new Error("La tarea está inactiva");

		const student = await prisma.user.findUnique({
			where: { id: studentId },
			select: { address: true, role: true },
		});
		if (!student || student.role !== "STUDENT") throw new Error("Estudiante no encontrado");

		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "awardBadge",
			args: [BigInt(task.taskId), student.address as `0x${string}`],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		try {
			await prisma.badgeAward.create({
				data: {
					userId: studentId,
					taskId: taskPrismaId,
					badgeTypeId: task.badgeTypeId,
					awardedById: session.userId!,
					txHash: hash,
				},
			});
		} catch (dbError) {
			logPrismaRecovery("awardBadge", hash, dbError);
			throw new Error(`Error al guardar en base de datos. TxHash: ${hash}`);
		}

		return { success: true };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		throw new Error(`Error al otorgar insignia: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

export async function listAwardsForTask(taskPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	return prisma.badgeAward.findMany({
		where: { taskId: taskPrismaId },
		include: { user: { select: { id: true, name: true, email: true } } },
		orderBy: { awardedAt: "desc" },
	});
}

export async function getStudentBadges() {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	return prisma.badgeAward.findMany({
		where: { userId: session.userId! },
		include: {
			badgeType: { select: { id: true, name: true, tokenId: true } },
			task: { select: { name: true, rewardAmount: true } },
		},
		orderBy: { awardedAt: "desc" },
	});
}

// ── Rewards ──────────────────────────────────────────────────────────────

export async function createReward(input: {
	name: string;
	description?: string;
	badgeCost: number;
	supply: number;
	badgeTypeId: string;
}) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	try {
		const name = input.name.trim();
		if (!name) throw new Error("El nombre es obligatorio");
		if (!Number.isInteger(input.badgeCost) || input.badgeCost < 1)
			throw new Error("El coste debe ser al menos 1");
		if (!Number.isInteger(input.supply) || input.supply < 0)
			throw new Error("El suministro debe ser un entero no negativo");

		const badgeType = await prisma.badgeType.findUnique({ where: { id: input.badgeTypeId } });
		if (!badgeType) throw new Error("Tipo de insignia no encontrado");

		const nextId = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "nextRewardId",
		}) as bigint;
		const rewardId = Number(nextId);

		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "createReward",
			args: [BigInt(badgeType.tokenId), BigInt(input.badgeCost), BigInt(input.supply)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		const reward = await prisma.reward.create({
			data: {
				rewardId,
				name,
				description: input.description?.trim() || null,
				badgeCost: input.badgeCost,
				supply: input.supply,
				badgeTypeId: input.badgeTypeId,
				creatorId: session.userId!,
				txHash: hash,
			},
		});

		return { success: true, reward };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		throw new Error(`Error al crear recompensa: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

export async function deactivateReward(rewardPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	try {
		const reward = await prisma.reward.findUnique({ where: { id: rewardPrismaId } });
		if (!reward) throw new Error("Recompensa no encontrada");

		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "deactivateReward",
			args: [BigInt(reward.rewardId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		await prisma.reward.update({ where: { id: rewardPrismaId }, data: { active: false } });

		return { success: true };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		throw new Error(`Error al desactivar recompensa: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

export async function listRewards(badgeTypeId?: string) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const where: Record<string, unknown> = {};
	if (badgeTypeId) where.badgeTypeId = badgeTypeId;
	if (session.role !== "ADMIN") where.creatorId = session.userId!;

	return prisma.reward.findMany({
		where,
		include: {
			badgeType: { select: { name: true, tokenId: true } },
			_count: { select: { redemptions: true } },
		},
		orderBy: { createdAt: "desc" },
	});
}

export async function listAvailableRewards() {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	return prisma.reward.findMany({
		where: { active: true },
		include: {
			badgeType: { select: { id: true, name: true, tokenId: true } },
			_count: { select: { redemptions: true } },
		},
		orderBy: { createdAt: "desc" },
	});
}

// ── Redemptions ──────────────────────────────────────────────────────────

export async function redeemReward(rewardPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	try {
		const reward = await prisma.reward.findUnique({ where: { id: rewardPrismaId } });
		if (!reward) throw new Error("Recompensa no encontrada");

		const { walletClient } = await getUserWalletClient(session.userId!);

		const hash = await walletClient.writeContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "redeemReward",
			args: [BigInt(reward.rewardId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		try {
			await prisma.rewardRedemption.create({
				data: {
					userId: session.userId!,
					rewardId: rewardPrismaId,
					txHash: hash,
				},
			});
		} catch (dbError) {
			logPrismaRecovery("redeemReward", hash, dbError);
			throw new Error(`Error al guardar en base de datos. TxHash: ${hash}`);
		}

		return { success: true };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		throw new Error(`Error al canjear recompensa: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

export async function getMyRedemptions() {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	return prisma.rewardRedemption.findMany({
		where: { userId: session.userId! },
		include: {
			reward: { select: { name: true, badgeCost: true, badgeType: { select: { name: true } } } },
		},
		orderBy: { redeemedAt: "desc" },
	});
}

// ── Use Requests ─────────────────────────────────────────────────────────

export async function requestUseReward(rewardPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	try {
		const reward = await prisma.reward.findUnique({ where: { id: rewardPrismaId } });
		if (!reward) throw new Error("Recompensa no encontrada");

		const { walletClient } = await getUserWalletClient(session.userId!);

		const hash = await walletClient.writeContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "requestUseReward",
			args: [BigInt(reward.rewardId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		return { success: true };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		throw new Error(`Error al solicitar uso: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

export async function cancelUseRequest(requestId: number) {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	try {
		const { walletClient } = await getUserWalletClient(session.userId!);

		const hash = await walletClient.writeContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "cancelUseRequest",
			args: [BigInt(requestId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		return { success: true };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		throw new Error(`Error al cancelar solicitud: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

export async function approveUseRequest(requestId: number) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	try {
		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "approveUseRequest",
			args: [BigInt(requestId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		return { success: true };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		throw new Error(`Error al aprobar solicitud: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

export async function rejectUseRequest(requestId: number) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	try {
		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
			abi: BADGE_SYSTEM_ABI,
			functionName: "rejectUseRequest",
			args: [BigInt(requestId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		return { success: true };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		throw new Error(`Error al rechazar solicitud: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

export async function getMyUseRequests() {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	const user = await prisma.user.findUnique({
		where: { id: session.userId! },
		select: { address: true },
	});
	if (!user) throw new Error("Usuario no encontrado");

	const requestIds = await publicClient.readContract({
		address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
		abi: BADGE_SYSTEM_ABI,
		functionName: "getStudentUseRequests",
		args: [user.address as `0x${string}`],
	}) as bigint[];

	const requests = await Promise.all(
		requestIds.map(async (id) => {
			const req = await publicClient.readContract({
				address: CONTRACT_ADDRESSES.badgeSystem as `0x${string}`,
				abi: BADGE_SYSTEM_ABI,
				functionName: "getUseRequest",
				args: [id],
			}) as { student: string; rewardId: bigint; status: number };

			const reward = await prisma.reward.findFirst({
				where: { rewardId: Number(req.rewardId) },
				select: { id: true, name: true, badgeType: { select: { name: true } } },
			});

			return {
				requestId: Number(id),
				rewardPrismaId: reward?.id ?? null,
				rewardName: reward?.name ?? "Desconocido",
				badgeTypeName: reward?.badgeType?.name ?? "Desconocido",
				status: req.status, // 0=None, 1=Pending, 2=Approved, 3=Rejected, 4=Cancelled
			};
		}),
	);

	return requests.filter(r => r.status !== 0); // Excluir None
}

// ── Stats ────────────────────────────────────────────────────────────────

export async function getBadgeStats() {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const where = session.role === "ADMIN" ? {} : { creatorId: session.userId! };

	const [totalBadgeTypes, totalTasks, totalAwards, totalRewards, totalRedemptions] = await Promise.all([
		prisma.badgeType.count({ where }),
		prisma.task.count({ where: session.role === "ADMIN" ? {} : { badgeType: { creatorId: session.userId! } } }),
		prisma.badgeAward.count({ where: session.role === "ADMIN" ? {} : { badgeType: { creatorId: session.userId! } } }),
		prisma.reward.count({ where: session.role === "ADMIN" ? {} : { badgeType: { creatorId: session.userId! } } }),
		prisma.rewardRedemption.count({ where: session.role === "ADMIN" ? {} : { reward: { creatorId: session.userId! } } }),
	]);

	return { totalBadgeTypes, totalTasks, totalAwards, totalRewards, totalRedemptions };
}

// ── Alumnos ──────────────────────────────────────────────────────────────

export async function getStudentsForSubject(subjectOfferingId: string) {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const offering = await prisma.subjectOffering.findUnique({
		where: { id: subjectOfferingId },
		include: { subject: true },
	});
	if (!offering) throw new Error("Asignatura no encontrada");

	const enrollments = await prisma.enrollment.findMany({
		where: { subjectOfferingId },
		include: { user: { select: { id: true, name: true, email: true } } },
	});

	const badgeTypes = await prisma.badgeType.findMany({
		where: { subjectOfferingId },
		select: { id: true, name: true },
	});
	const badgeTypeIds = badgeTypes.map(bt => bt.id);

	const tasks = await prisma.task.findMany({
		where: { badgeTypeId: { in: badgeTypeIds } },
		select: { id: true, name: true, badgeTypeId: true },
	});

	const students = await Promise.all(
		enrollments.map(async (enrollment) => {
			const [awards, redemptions] = await Promise.all([
				prisma.badgeAward.findMany({
					where: { userId: enrollment.user.id, badgeTypeId: { in: badgeTypeIds } },
					select: { taskId: true, badgeTypeId: true, awardedAt: true },
				}),
				prisma.rewardRedemption.findMany({
					where: { userId: enrollment.user.id, reward: { badgeTypeId: { in: badgeTypeIds } } },
					include: { reward: { select: { name: true } } },
				}),
			]);

			const completedTaskIds = new Set(awards.map(a => a.taskId));

			return {
				id: enrollment.user.id,
				name: enrollment.user.name,
				email: enrollment.user.email,
				totalBadges: awards.length,
				tasksCompleted: tasks.map(t => ({
					taskId: t.id,
					taskName: t.name,
					completed: completedTaskIds.has(t.id),
				})),
				redemptions: redemptions.map(r => ({
					rewardName: r.reward.name,
					date: r.redeemedAt.toISOString(),
				})),
			};
		}),
	);

	return { subject: offering.subject.name, students };
}

// ── Subject Offerings (para selects) ─────────────────────────────────────

export async function getMySubjectOfferings() {
	const session = await getSession();
	ensureRole(session, ["PROFESSOR", "ADMIN"]);

	const where = session.role === "ADMIN" ? {} : { professorId: session.userId! };

	return prisma.subjectOffering.findMany({
		where,
		include: { subject: { select: { name: true, code: true } } },
		orderBy: { academicYear: "desc" },
	});
}
