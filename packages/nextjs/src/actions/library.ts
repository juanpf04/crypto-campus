/**
 * library.ts — Server Actions para el módulo de biblioteca.
 *
 * Gestiona ítems prestables (libros, juegos, videojuegos, etc.) y préstamos.
 * El contrato LibraryManager es genérico: el tipo de ítem se distingue solo en Prisma.
 *
 * Patrón de transacciones:
 * - Operaciones de LIBRARIAN/ADMIN (addItem, confirmPickup, confirmReturn, etc.):
 *   firmadas por adminWalletClient (Account[0] de Hardhat).
 * - Operaciones de ESTUDIANTE (requestLoan, cancelLoan):
 *   firmadas por la wallet custodial del estudiante.
 */

"use server";

import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionData } from "@/lib/session";
import { decrypt } from "@/lib/crypto";
import { adminWalletClient, publicClient } from "@/lib/viem";
import {
	CONTRACT_ADDRESSES,
	LIBRARY_MANAGER_ABI,
	LIBRARY_TOKEN_ABI,
} from "@/lib/contracts";

// ── Tipos ────────────────────────────────────────────────────────────────

type Role = "STUDENT" | "PROFESSOR" | "LIBRARIAN" | "ADMIN";

// ── Helpers internos ─────────────────────────────────────────────────────

async function getSession() {
	return getIronSession<SessionData>(await cookies(), sessionOptions);
}

function ensureRole(session: SessionData, allowed: Role[]) {
	if (!session.userId || !session.role || !allowed.includes(session.role as Role)) {
		throw new Error("No autorizado");
	}
}

function ensurePositiveInt(value: number, fieldName: string): number {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${fieldName} debe ser un entero positivo`);
	}
	return value;
}

function cleanString(value: string, fieldName: string): string {
	const normalized = value.trim();
	if (!normalized) {
		throw new Error(`${fieldName} es obligatorio`);
	}
	return normalized;
}

async function getUserWalletClient(userId: string) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { address: true, encryptedKey: true },
	});
	if (!user) throw new Error("Usuario no encontrado");

	const privateKey = decrypt(user.encryptedKey) as `0x${string}`;
	const account = privateKeyToAccount(privateKey);

	const walletClient = createWalletClient({
		account,
		chain: hardhat,
		transport: http(),
	});

	return { walletClient, address: user.address };
}

// ── Ítems (CRUD) ─────────────────────────────────────────────────────────

/**
 * Añade un nuevo ítem al catálogo (on-chain addBook + Prisma).
 * Acceso: LIBRARIAN, ADMIN.
 */
export async function addItem(input: {
	title: string;
	type: "BOOK" | "BOARD_GAME" | "VIDEO_GAME" | "OTHER";
	creator?: string;
	description?: string;
	coverUrl?: string;
	category?: string;
	physicalLocation?: string;
	physicalCondition?: string;
	copies: number;
	metadata?: Record<string, string | number | boolean>;
}) {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	try {
		const title = cleanString(input.title, "El título");
		const copies = ensurePositiveInt(input.copies, "Las copias");

		// Leer nextBookId antes de crear
		const nextBookId = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.libraryManager as `0x${string}`,
			abi: LIBRARY_MANAGER_ABI,
			functionName: "nextBookId",
		}) as bigint;
		const tokenId = Number(nextBookId);

		// 1. Registrar on-chain
		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.libraryManager as `0x${string}`,
			abi: LIBRARY_MANAGER_ABI,
			functionName: "addBook",
			args: [BigInt(copies)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });

		if (receipt.status !== "success") {
			throw new Error("La transacción de creación fue revertida");
		}

		// 2. Guardar metadatos en Prisma
		const item = await prisma.libraryItem.create({
			data: {
				tokenId,
				type: input.type,
				title,
				creator: input.creator?.trim() || null,
				description: input.description?.trim() || null,
				coverUrl: input.coverUrl?.trim() || null,
				category: input.category?.trim() || null,
				physicalLocation: input.physicalLocation?.trim() || null,
				physicalCondition: input.physicalCondition?.trim() || "Bueno",
				totalCopies: copies,
				metadata: input.metadata ?? undefined,
			},
		});

		return { success: true, item, txHash: hash };
	} catch (error) {
		if (error instanceof Error && error.message === "No autorizado") throw error;
		throw new Error(`Error al crear ítem: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Actualiza metadatos de un ítem (solo Prisma, no on-chain).
 * Acceso: LIBRARIAN, ADMIN.
 */
export async function updateItem(
	itemId: string,
	input: {
		title?: string;
		type?: "BOOK" | "BOARD_GAME" | "VIDEO_GAME" | "OTHER";
		creator?: string;
		description?: string;
		coverUrl?: string;
		category?: string;
		physicalLocation?: string;
		physicalCondition?: string;
		metadata?: Record<string, string | number | boolean>;
	},
) {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	try {
		const existing = await prisma.libraryItem.findUnique({ where: { id: itemId } });
		if (!existing) throw new Error("Ítem no encontrado");

		const data: Record<string, unknown> = {};
		if (input.title !== undefined) data.title = cleanString(input.title, "El título");
		if (input.type !== undefined) data.type = input.type;
		if (input.creator !== undefined) data.creator = input.creator.trim() || null;
		if (input.description !== undefined) data.description = input.description.trim() || null;
		if (input.coverUrl !== undefined) data.coverUrl = input.coverUrl.trim() || null;
		if (input.category !== undefined) data.category = input.category.trim() || null;
		if (input.physicalLocation !== undefined) data.physicalLocation = input.physicalLocation.trim() || null;
		if (input.physicalCondition !== undefined) data.physicalCondition = input.physicalCondition.trim() || null;
		if (input.metadata !== undefined) data.metadata = input.metadata;

		const item = await prisma.libraryItem.update({
			where: { id: itemId },
			data,
		});

		return { success: true, item };
	} catch (error) {
		if (error instanceof Error && error.message === "No autorizado") throw error;
		throw new Error(`Error al actualizar ítem: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Añade copias adicionales a un ítem existente (on-chain + Prisma).
 * Acceso: LIBRARIAN, ADMIN.
 */
export async function addCopies(itemId: string, amount: number) {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	try {
		const copies = ensurePositiveInt(amount, "Las copias");

		const existing = await prisma.libraryItem.findUnique({ where: { id: itemId } });
		if (!existing) throw new Error("Ítem no encontrado");

		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.libraryManager as `0x${string}`,
			abi: LIBRARY_MANAGER_ABI,
			functionName: "addCopies",
			args: [BigInt(existing.tokenId), BigInt(copies)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });

		if (receipt.status !== "success") {
			throw new Error("La transacción fue revertida");
		}

		const item = await prisma.libraryItem.update({
			where: { id: itemId },
			data: { totalCopies: existing.totalCopies + copies },
		});

		return { success: true, item, txHash: hash };
	} catch (error) {
		if (error instanceof Error && error.message === "No autorizado") throw error;
		throw new Error(`Error al añadir copias: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Desactiva un ítem (soft delete solo en Prisma, no quema copias on-chain).
 * Acceso: LIBRARIAN, ADMIN.
 */
export async function deactivateItem(itemId: string) {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	try {
		const existing = await prisma.libraryItem.findUnique({ where: { id: itemId } });
		if (!existing) throw new Error("Ítem no encontrado");

		await prisma.libraryItem.update({
			where: { id: itemId },
			data: { active: false },
		});

		return { success: true };
	} catch (error) {
		if (error instanceof Error && error.message === "No autorizado") throw error;
		throw new Error(`Error al desactivar ítem: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Reactiva un ítem desactivado.
 * Acceso: LIBRARIAN, ADMIN.
 */
export async function reactivateItem(itemId: string) {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	try {
		const existing = await prisma.libraryItem.findUnique({ where: { id: itemId } });
		if (!existing) throw new Error("Ítem no encontrado");

		await prisma.libraryItem.update({
			where: { id: itemId },
			data: { active: true },
		});

		return { success: true };
	} catch (error) {
		if (error instanceof Error && error.message === "No autorizado") throw error;
		throw new Error(`Error al reactivar ítem: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lista ítems del catálogo con filtros opcionales.
 * Acceso: cualquier usuario autenticado.
 */
export async function listItems(filters?: {
	type?: "BOOK" | "BOARD_GAME" | "VIDEO_GAME" | "OTHER";
	category?: string;
	activeOnly?: boolean;
	search?: string;
	limit?: number;
	offset?: number;
}) {
	const session = await getSession();
	if (!session.userId) throw new Error("No autorizado");

	const where: Record<string, unknown> = {};
	if (filters?.type) where.type = filters.type;
	if (filters?.category) where.category = filters.category;
	if (filters?.activeOnly !== false) where.active = true;
	if (filters?.search) {
		where.OR = [
			{ title: { contains: filters.search, mode: "insensitive" } },
			{ creator: { contains: filters.search, mode: "insensitive" } },
			{ description: { contains: filters.search, mode: "insensitive" } },
		];
	}

	const [items, total] = await Promise.all([
		prisma.libraryItem.findMany({
			where,
			orderBy: { createdAt: "desc" },
			...(filters?.limit ? { take: filters.limit } : {}),
			...(filters?.offset ? { skip: filters.offset } : {}),
		}),
		prisma.libraryItem.count({ where }),
	]);

	return { items, total };
}

/**
 * Obtiene un ítem con sus copias disponibles (lectura on-chain).
 * Acceso: cualquier usuario autenticado.
 */
export async function getItem(itemId: string) {
	const session = await getSession();
	if (!session.userId) throw new Error("No autorizado");

	const item = await prisma.libraryItem.findUnique({
		where: { id: itemId },
		include: {
			loans: {
				where: { status: { in: ["QUEUED", "RESERVED", "PICKED_UP"] } },
				include: { user: { select: { id: true, name: true, email: true } } },
				orderBy: { requestDate: "desc" },
			},
		},
	});
	if (!item) throw new Error("Ítem no encontrado");

	// Leer copias disponibles on-chain
	let availableCopies = 0;
	try {
		const result = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.libraryManager as `0x${string}`,
			abi: LIBRARY_MANAGER_ABI,
			functionName: "getAvailableCopies",
			args: [BigInt(item.tokenId)],
		}) as bigint;
		availableCopies = Number(result);
	} catch {
		// Si falla la lectura on-chain, estimamos desde Prisma
		const activeLoans = item.loans.filter(l => l.status === "RESERVED" || l.status === "PICKED_UP").length;
		availableCopies = Math.max(0, item.totalCopies - activeLoans);
	}

	return { ...item, availableCopies };
}

/**
 * Obtiene las categorías únicas de los ítems activos.
 */
export async function getItemCategories() {
	const session = await getSession();
	if (!session.userId) throw new Error("No autorizado");

	const categories = await prisma.libraryItem.findMany({
		where: { active: true, category: { not: null } },
		select: { category: true },
		distinct: ["category"],
		orderBy: { category: "asc" },
	});

	return categories.map(c => c.category).filter(Boolean) as string[];
}

// ── Préstamos (sistema de colas con auto-reserva) ───────────────────────

/**
 * Helper: procesa eventos LoanReserved de un receipt para actualizar
 * préstamos auto-reservados en Prisma (de QUEUED a RESERVED).
 */
async function processQueueEvents(receipt: { logs: readonly { data: string; topics: readonly string[] }[] }) {
	const { decodeEventLog } = await import("viem");
	for (const log of receipt.logs) {
		try {
			const event = decodeEventLog({
				abi: LIBRARY_MANAGER_ABI,
				data: log.data as `0x${string}`,
				topics: log.topics as [string, ...string[]],
			});
			if (event.eventName === "LoanReserved") {
				const args = event.args as { loanId: bigint };
				await prisma.loan.updateMany({
					where: { loanId: Number(args.loanId), status: "QUEUED" },
					data: { status: "RESERVED", reservationDate: new Date() },
				});
			}
		} catch { /* log no es nuestro evento */ }
	}
}

/**
 * Estudiante solicita un préstamo.
 * Si hay copias → RESERVED. Si no → QUEUED (cola de espera).
 * En ambos casos se bloquea 1 LibraryToken como depósito.
 */
export async function requestLoan(itemId: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	try {
		const item = await prisma.libraryItem.findUnique({ where: { id: itemId } });
		if (!item || !item.active) throw new Error("Ítem no encontrado o inactivo");

		const existingLoan = await prisma.loan.findFirst({
			where: {
				userId: session.userId!,
				libraryItemId: item.id,
				status: { in: ["QUEUED", "RESERVED", "PICKED_UP"] },
			},
		});
		if (existingLoan) throw new Error("Ya tienes un préstamo activo o pendiente de este ítem");

		const nextLoanId = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.libraryManager as `0x${string}`,
			abi: LIBRARY_MANAGER_ABI,
			functionName: "nextLoanId",
		}) as bigint;
		const loanId = Number(nextLoanId);

		const { walletClient } = await getUserWalletClient(session.userId!);

		const hash = await walletClient.writeContract({
			address: CONTRACT_ADDRESSES.libraryManager as `0x${string}`,
			abi: LIBRARY_MANAGER_ABI,
			functionName: "requestLoan",
			args: [BigInt(item.tokenId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		// Leer estado del préstamo on-chain para saber si quedó QUEUED o RESERVED
		const loanInfo = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.libraryManager as `0x${string}`,
			abi: LIBRARY_MANAGER_ABI,
			functionName: "getLoanInfo",
			args: [BigInt(loanId)],
		}) as { status: number; reservationDate: bigint };

		const isReserved = loanInfo.status === 2; // Reserved = 2

		const loan = await prisma.loan.create({
			data: {
				loanId,
				libraryItemId: item.id,
				userId: session.userId!,
				status: isReserved ? "RESERVED" : "QUEUED",
				requestTxHash: hash,
				reservationDate: isReserved ? new Date() : null,
			},
		});

		return { success: true, loan, queued: !isReserved };
	} catch (error) {
		if (error instanceof Error && error.message === "No autorizado") throw error;
		throw new Error(`Error al solicitar préstamo: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Estudiante cancela su préstamo (QUEUED o RESERVED).
 * Devuelve el depósito. Si era RESERVED, procesa la cola.
 */
export async function cancelLoan(loanPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	try {
		const loan = await prisma.loan.findUnique({ where: { id: loanPrismaId } });
		if (!loan) throw new Error("Préstamo no encontrado");
		if (loan.userId !== session.userId) throw new Error("No autorizado");
		if (loan.status !== "QUEUED" && loan.status !== "RESERVED")
			throw new Error("Solo se pueden cancelar préstamos en cola o reservados");

		const { walletClient } = await getUserWalletClient(session.userId!);

		const hash = await walletClient.writeContract({
			address: CONTRACT_ADDRESSES.libraryManager as `0x${string}`,
			abi: LIBRARY_MANAGER_ABI,
			functionName: "cancelLoan",
			args: [BigInt(loan.loanId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		await prisma.loan.update({
			where: { id: loanPrismaId },
			data: { status: "CANCELLED" },
		});

		// Procesar auto-reservas de la cola
		await processQueueEvents(receipt);

		return { success: true };
	} catch (error) {
		if (error instanceof Error && error.message === "No autorizado") throw error;
		throw new Error(`Error al cancelar préstamo: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Bibliotecario confirma la recogida física del ítem.
 * Transfiere el libro al estudiante y arranca el plazo de 21 días.
 */
export async function confirmPickup(loanPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	try {
		const loan = await prisma.loan.findUnique({ where: { id: loanPrismaId } });
		if (!loan) throw new Error("Préstamo no encontrado");
		if (loan.status !== "RESERVED") throw new Error("Solo se pueden recoger préstamos reservados");

		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.libraryManager as `0x${string}`,
			abi: LIBRARY_MANAGER_ABI,
			functionName: "confirmPickup",
			args: [BigInt(loan.loanId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		const loanInfo = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.libraryManager as `0x${string}`,
			abi: LIBRARY_MANAGER_ABI,
			functionName: "getLoanInfo",
			args: [BigInt(loan.loanId)],
		}) as { dueDate: bigint; pickupDate: bigint };

		await prisma.loan.update({
			where: { id: loanPrismaId },
			data: {
				status: "PICKED_UP",
				pickupTxHash: hash,
				pickupDate: new Date(),
				dueDate: new Date(Number(loanInfo.dueDate) * 1000),
			},
		});

		return { success: true };
	} catch (error) {
		if (error instanceof Error && error.message === "No autorizado") throw error;
		throw new Error(`Error al confirmar recogida: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Bibliotecario confirma la devolución física.
 * Devuelve depósito y procesa la cola.
 */
export async function confirmReturn(loanPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	try {
		const loan = await prisma.loan.findUnique({ where: { id: loanPrismaId } });
		if (!loan) throw new Error("Préstamo no encontrado");
		if (loan.status !== "PICKED_UP") throw new Error("Solo se pueden devolver préstamos recogidos");

		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.libraryManager as `0x${string}`,
			abi: LIBRARY_MANAGER_ABI,
			functionName: "confirmReturn",
			args: [BigInt(loan.loanId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		const isOverdue = loan.dueDate ? new Date() > loan.dueDate : false;

		await prisma.loan.update({
			where: { id: loanPrismaId },
			data: {
				status: "RETURNED",
				returnTxHash: hash,
				returnDate: new Date(),
				overdue: isOverdue,
			},
		});

		await processQueueEvents(receipt);

		return { success: true };
	} catch (error) {
		if (error instanceof Error && error.message === "No autorizado") throw error;
		throw new Error(`Error al confirmar devolución: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Bibliotecario fuerza la devolución de un préstamo vencido.
 * El depósito NO se devuelve (penalización). Procesa la cola.
 */
export async function forceReturn(loanPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	try {
		const loan = await prisma.loan.findUnique({ where: { id: loanPrismaId } });
		if (!loan) throw new Error("Préstamo no encontrado");
		if (loan.status !== "PICKED_UP") throw new Error("Solo se pueden forzar devoluciones de préstamos recogidos");

		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.libraryManager as `0x${string}`,
			abi: LIBRARY_MANAGER_ABI,
			functionName: "forceReturn",
			args: [BigInt(loan.loanId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		await prisma.loan.update({
			where: { id: loanPrismaId },
			data: {
				status: "RETURNED",
				returnTxHash: hash,
				returnDate: new Date(),
				overdue: true,
			},
		});

		await processQueueEvents(receipt);

		return { success: true };
	} catch (error) {
		if (error instanceof Error && error.message === "No autorizado") throw error;
		throw new Error(`Error al forzar devolución: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Bibliotecario expira una reserva no recogida tras el timeout (3 días).
 * Devuelve depósito y procesa la cola.
 */
export async function expireReservation(loanPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	try {
		const loan = await prisma.loan.findUnique({ where: { id: loanPrismaId } });
		if (!loan) throw new Error("Préstamo no encontrado");
		if (loan.status !== "RESERVED") throw new Error("Solo se pueden expirar reservas");

		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.libraryManager as `0x${string}`,
			abi: LIBRARY_MANAGER_ABI,
			functionName: "expireReservation",
			args: [BigInt(loan.loanId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") throw new Error("La transacción fue revertida");

		await prisma.loan.update({
			where: { id: loanPrismaId },
			data: { status: "CANCELLED" },
		});

		await processQueueEvents(receipt);

		return { success: true };
	} catch (error) {
		if (error instanceof Error && error.message === "No autorizado") throw error;
		throw new Error(`Error al expirar reserva: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lista todos los préstamos con filtros opcionales.
 * Acceso: LIBRARIAN, ADMIN.
 */
export async function listLoans(filters?: {
	status?: "QUEUED" | "RESERVED" | "PICKED_UP" | "RETURNED" | "CANCELLED";
	itemId?: string;
	limit?: number;
	offset?: number;
}) {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	const where: Record<string, unknown> = {};
	if (filters?.status) where.status = filters.status;
	if (filters?.itemId) where.libraryItemId = filters.itemId;

	const [items, total] = await Promise.all([
		prisma.loan.findMany({
			where,
			include: {
				libraryItem: { select: { id: true, title: true, type: true, tokenId: true, coverUrl: true } },
				user: { select: { id: true, name: true, email: true } },
			},
			orderBy: { requestDate: "desc" },
			...(filters?.limit ? { take: filters.limit } : {}),
			...(filters?.offset ? { skip: filters.offset } : {}),
		}),
		prisma.loan.count({ where }),
	]);

	return { items, total };
}

/**
 * Lista reservas pendientes de recogida (RESERVED).
 * Acceso: LIBRARIAN, ADMIN.
 */
export async function listPendingPickups(filters?: { limit?: number; offset?: number }) {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	const where = { status: "RESERVED" as const };

	const [items, total] = await Promise.all([
		prisma.loan.findMany({
			where,
			include: {
				libraryItem: { select: { id: true, title: true, type: true, tokenId: true, coverUrl: true } },
				user: { select: { id: true, name: true, email: true } },
			},
			orderBy: { reservationDate: "asc" },
			...(filters?.limit ? { take: filters.limit } : {}),
			...(filters?.offset ? { skip: filters.offset } : {}),
		}),
		prisma.loan.count({ where }),
	]);

	return { items, total };
}

/**
 * Obtiene los préstamos del estudiante actual con posición en cola.
 * Acceso: STUDENT.
 */
export async function getMyLoans() {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	const loans = await prisma.loan.findMany({
		where: { userId: session.userId! },
		include: {
			libraryItem: { select: { id: true, title: true, type: true, coverUrl: true, creator: true } },
		},
		orderBy: { requestDate: "desc" },
	});

	// Para préstamos en cola, obtener la posición
	const loansWithQueue = await Promise.all(
		loans.map(async (loan) => {
			if (loan.status === "QUEUED") {
				try {
					const pos = await publicClient.readContract({
						address: CONTRACT_ADDRESSES.libraryManager as `0x${string}`,
						abi: LIBRARY_MANAGER_ABI,
						functionName: "getQueuePosition",
						args: [BigInt(loan.loanId)],
					}) as bigint;
					return { ...loan, queuePosition: Number(pos) };
				} catch {
					return { ...loan, queuePosition: null };
				}
			}
			return { ...loan, queuePosition: null };
		}),
	);

	return loansWithQueue;
}

/**
 * Lee el balance de LibraryTokens de un usuario on-chain.
 */
export async function getLibraryBalance(userId?: string) {
	const session = await getSession();
	if (!session.userId) throw new Error("No autorizado");

	const targetUserId = userId || session.userId!;

	if (targetUserId !== session.userId) {
		ensureRole(session, ["LIBRARIAN", "ADMIN"]);
	}

	const user = await prisma.user.findUnique({
		where: { id: targetUserId },
		select: { address: true },
	});
	if (!user) throw new Error("Usuario no encontrado");

	const balance = await publicClient.readContract({
		address: CONTRACT_ADDRESSES.libraryToken as `0x${string}`,
		abi: LIBRARY_TOKEN_ABI,
		functionName: "balanceOf",
		args: [user.address as `0x${string}`],
	}) as bigint;

	return Number(balance);
}

/**
 * Estadísticas de la biblioteca para el dashboard.
 * Acceso: LIBRARIAN, ADMIN.
 */
export async function getLibraryStats() {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	const now = new Date();
	const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

	const [
		totalItems, activeItems, totalLoans,
		queuedLoans, pendingPickups, activeLoans, overdueLoans,
		onTimeReturned, totalReturned,
		itemsByType, topItemsRaw, recentLoansRaw, loansLast6Months,
	] = await Promise.all([
		prisma.libraryItem.count(),
		prisma.libraryItem.count({ where: { active: true } }),
		prisma.loan.count(),
		prisma.loan.count({ where: { status: "QUEUED" } }),
		prisma.loan.count({ where: { status: "RESERVED" } }),
		prisma.loan.count({ where: { status: "PICKED_UP" } }),
		prisma.loan.count({ where: { status: "PICKED_UP", dueDate: { lt: now } } }),
		prisma.loan.count({ where: { status: "RETURNED", overdue: false } }),
		prisma.loan.count({ where: { status: "RETURNED" } }),
		prisma.libraryItem.groupBy({ by: ["type"], where: { active: true }, _count: true }),
		prisma.loan.groupBy({
			by: ["libraryItemId"],
			_count: { id: true },
			orderBy: { _count: { id: "desc" } },
			take: 5,
		}),
		prisma.loan.findMany({
			take: 5,
			orderBy: { requestDate: "desc" },
			include: {
				libraryItem: { select: { title: true, type: true } },
				user: { select: { name: true } },
			},
		}),
		prisma.loan.findMany({
			where: { requestDate: { gte: sixMonthsAgo } },
			select: { requestDate: true },
		}),
	]);

	const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
	const loansByMonth: { month: string; count: number }[] = [];
	for (let i = 5; i >= 0; i--) {
		const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
		const key = `${d.getFullYear()}-${d.getMonth()}`;
		const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
		const count = loansLast6Months.filter((l) => {
			const rd = new Date(l.requestDate);
			return `${rd.getFullYear()}-${rd.getMonth()}` === key;
		}).length;
		loansByMonth.push({ month: label, count });
	}

	const topItemIds = topItemsRaw.map((t) => t.libraryItemId);
	const topItemDetails = await prisma.libraryItem.findMany({
		where: { id: { in: topItemIds } },
		select: { id: true, title: true, type: true },
	});
	const topItems = topItemsRaw.map((t) => {
		const item = topItemDetails.find((d) => d.id === t.libraryItemId);
		return { title: item?.title ?? "Desconocido", type: item?.type ?? "OTHER", loanCount: t._count.id };
	});

	const onTimeRate = totalReturned > 0 ? Math.round((onTimeReturned / totalReturned) * 100) : 100;

	const recentLoans = recentLoansRaw.map((l) => ({
		title: l.libraryItem.title,
		userName: l.user.name,
		status: l.status,
		date: l.requestDate.toISOString(),
	}));

	return {
		totalItems,
		activeItems,
		totalLoans,
		queuedLoans,
		pendingPickups,
		activeLoans,
		overdueLoans,
		onTimeRate,
		loansByMonth,
		itemsByType: itemsByType.map((g) => ({ type: g.type, count: g._count })),
		topItems,
		recentLoans,
	};
}

// ── LibraryTokens Management ─────────────────────────────────────────────

/**
 * Mintea LibraryTokens a un estudiante.
 * Acceso: ADMIN.
 */
export async function mintLibraryTokens(userId: string, amount: number) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		if (!Number.isInteger(amount) || amount < 0) {
			throw new Error("La cantidad debe ser un entero no negativo");
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { address: true, name: true },
		});
		if (!user) throw new Error("Usuario no encontrado");

		// Leer balance actual
		const currentBalance = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.libraryToken as `0x${string}`,
			abi: LIBRARY_TOKEN_ABI,
			functionName: "balanceOf",
			args: [user.address as `0x${string}`],
		}) as bigint;

		const current = Number(currentBalance);

		if (amount > current) {
			// Mintear la diferencia
			const toMint = amount - current;
			const hash = await adminWalletClient.writeContract({
				address: CONTRACT_ADDRESSES.libraryToken as `0x${string}`,
				abi: LIBRARY_TOKEN_ABI,
				functionName: "mint",
				args: [user.address as `0x${string}`, BigInt(toMint)],
			});
			const receipt = await publicClient.waitForTransactionReceipt({ hash });
			if (receipt.status !== "success") {
				throw new Error("La transacción de mint fue revertida");
			}
		} else if (amount < current) {
			// Quemar la diferencia
			const toBurn = current - amount;
			const hash = await adminWalletClient.writeContract({
				address: CONTRACT_ADDRESSES.libraryToken as `0x${string}`,
				abi: LIBRARY_TOKEN_ABI,
				functionName: "burn",
				args: [user.address as `0x${string}`, BigInt(toBurn)],
			});
			const receipt = await publicClient.waitForTransactionReceipt({ hash });
			if (receipt.status !== "success") {
				throw new Error("La transacción de burn fue revertida");
			}
		}

		// Leer balance final
		const finalBalance = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.libraryToken as `0x${string}`,
			abi: LIBRARY_TOKEN_ABI,
			functionName: "balanceOf",
			args: [user.address as `0x${string}`],
		}) as bigint;

		return { success: true, balance: Number(finalBalance) };
	} catch (error) {
		if (error instanceof Error && error.message === "No autorizado") throw error;
		throw new Error(`Error al asignar tokens: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lista todos los estudiantes con sus balances de LibraryTokens.
 * Acceso: ADMIN.
 */
export async function listStudentTokenBalances() {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	const students = await prisma.user.findMany({
		where: { role: "STUDENT", active: true },
		select: { id: true, name: true, email: true, address: true },
		orderBy: { name: "asc" },
	});

	const withBalances = await Promise.all(
		students.map(async (student) => {
			try {
				const balance = await publicClient.readContract({
					address: CONTRACT_ADDRESSES.libraryToken as `0x${string}`,
					abi: LIBRARY_TOKEN_ABI,
					functionName: "balanceOf",
					args: [student.address as `0x${string}`],
				}) as bigint;
				return { id: student.id, name: student.name, email: student.email, balance: Number(balance) };
			} catch {
				return { id: student.id, name: student.name, email: student.email, balance: null as number | null };
			}
		}),
	);

	return withBalances;
}
