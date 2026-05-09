/**
 * rooms.ts — Server Actions para el módulo de reserva de salas.
 *
 * Gestiona salas de estudio y sus reservas.
 * Reglas: slots de 1 hora exacta, máximo 4 horas consecutivas, 1 sala por estudiante al día.
 *
 * Patrón de transacciones:
 * - Gestión de salas (LIBRARIAN/ADMIN): firmadas por adminWalletClient.
 * - Reservas (STUDENT): firmadas por la wallet custodial del estudiante.
 */

"use server";

import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { getSession, ensureRole } from "@/lib/auth";
import { isContractPauseError, translateContractError } from "@/lib/contractErrors";
import { adminWalletClient, publicClient } from "@/lib/viem";
import {
	CONTRACT_ADDRESSES,
	ROOM_BOOKING_ABI,
} from "@/lib/contracts";
import { issueReward, ShopTokenRewardReason, type RewardGrant } from "@/lib/shopRewards";
import { ensureOnChainId, ONLY_LIVE } from "@/lib/historical";

// ── Helpers internos ─────────────────────────────────────────────────────

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

/**
 * Convierte una fecha a timestamp de medianoche UTC (para el contrato).
 */
function dateToMidnightTimestamp(date: Date): bigint {
	const d = new Date(date);
	d.setUTCHours(0, 0, 0, 0);
	return BigInt(Math.floor(d.getTime() / 1000));
}

// ── Gestión de salas (LIBRARIAN/ADMIN) ───────────────────────────────────

/**
 * Crea una nueva sala.
 */
export async function addRoom(input: {
	name: string;
	description?: string;
	location?: string;
	capacity: number;
	amenities?: Record<string, boolean>;
}) {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	try {
		const name = cleanString(input.name, "El nombre");
		const capacity = ensurePositiveInt(input.capacity, "La capacidad");

		// Leer nextRoomId antes de crear
		const nextRoomId = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.roomBooking as `0x${string}`,
			abi: ROOM_BOOKING_ABI,
			functionName: "nextRoomId",
		}) as bigint;
		const roomId = Number(nextRoomId);

		// 1. Registrar on-chain
		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.roomBooking as `0x${string}`,
			abi: ROOM_BOOKING_ABI,
			functionName: "addRoom",
			args: [BigInt(capacity)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });

		if (receipt.status !== "success") {
			throw new Error("La transacción fue revertida");
		}

		// 2. Guardar en Prisma
		const room = await prisma.room.create({
			data: {
				roomId,
				name,
				description: input.description?.trim() || null,
				location: input.location?.trim() || null,
				capacity,
				amenities: input.amenities || undefined,
				txHash: hash,
			},
		});

		return { success: true, room };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		throw new Error(`Error al crear sala: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Actualiza una sala existente (on-chain + Prisma).
 */
export async function updateRoom(
	roomPrismaId: string,
	input: {
		name?: string;
		description?: string;
		location?: string;
		capacity?: number;
		amenities?: Record<string, boolean>;
		active?: boolean;
	},
) {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	try {
		const existing = await prisma.room.findUnique({ where: { id: roomPrismaId } });
		if (!existing) throw new Error("Sala no encontrada");

		const newCapacity = input.capacity !== undefined
			? ensurePositiveInt(input.capacity, "La capacidad")
			: existing.capacity;
		const newActive = input.active !== undefined ? input.active : existing.active;

		// Actualizar on-chain si capacidad o estado cambiaron
		if (newCapacity !== existing.capacity || newActive !== existing.active) {
			const hash = await adminWalletClient.writeContract({
				address: CONTRACT_ADDRESSES.roomBooking as `0x${string}`,
				abi: ROOM_BOOKING_ABI,
				functionName: "updateRoom",
				args: [BigInt(existing.roomId), BigInt(newCapacity), newActive],
			});
			const receipt = await publicClient.waitForTransactionReceipt({ hash });
			if (receipt.status !== "success") {
				throw new Error("La transacción fue revertida");
			}
		}

		// Actualizar Prisma
		const data: Record<string, unknown> = {};
		if (input.name !== undefined) data.name = cleanString(input.name, "El nombre");
		if (input.description !== undefined) data.description = input.description.trim() || null;
		if (input.location !== undefined) data.location = input.location.trim() || null;
		if (input.capacity !== undefined) data.capacity = newCapacity;
		if (input.amenities !== undefined) data.amenities = input.amenities;
		if (input.active !== undefined) data.active = newActive;

		const room = await prisma.room.update({
			where: { id: roomPrismaId },
			data,
		});

		return { success: true, room };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		throw new Error(`Error al actualizar sala: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Desactiva una sala permanentemente.
 */
export async function removeRoom(roomPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	try {
		const existing = await prisma.room.findUnique({ where: { id: roomPrismaId } });
		if (!existing) throw new Error("Sala no encontrada");

		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.roomBooking as `0x${string}`,
			abi: ROOM_BOOKING_ABI,
			functionName: "removeRoom",
			args: [BigInt(existing.roomId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });

		if (receipt.status !== "success") {
			throw new Error("La transacción fue revertida");
		}

		await prisma.room.update({
			where: { id: roomPrismaId },
			data: { active: false },
		});

		return { success: true };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		throw new Error(`Error al eliminar sala: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lista todas las salas.
 *
 * Cada sala incluye `activeBookingCount`: número de reservas no canceladas
 * con fecha desde hoy en adelante. Como las reservas solo pueden ser para
 * el mismo día, en la práctica esto cuenta las reservas activas de hoy.
 * Se usa para bloquear desactivación si la sala tiene reservas pendientes.
 */
export async function listRooms(activeOnly = true, limit?: number, offset?: number) {
	const session = await getSession();
	if (!session.userId) throw new Error("No autenticado");

	const where = activeOnly ? { active: true } : {};

	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);

	const [rawItems, total] = await Promise.all([
		prisma.room.findMany({
			where,
			orderBy: { name: "asc" },
			include: {
				_count: {
					select: {
						bookings: {
							where: {
								cancelled: false,
								date: { gte: startOfToday },
							},
						},
					},
				},
			},
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {}),
		}),
		prisma.room.count({ where }),
	]);

	// Aplanar `_count.bookings` en `activeBookingCount` para no exponer el
	// shape interno de Prisma a los consumidores.
	const items = rawItems.map(({ _count, ...rest }) => ({
		...rest,
		activeBookingCount: _count.bookings,
	}));

	return { items, total };
}

/**
 * Obtiene detalle de una sala.
 */
export async function getRoom(roomPrismaId: string) {
	const session = await getSession();
	if (!session.userId) throw new Error("No autenticado");

	const room = await prisma.room.findUnique({
		where: { id: roomPrismaId },
	});
	if (!room) throw new Error("Sala no encontrada");

	return room;
}

// ── Reservas ─────────────────────────────────────────────────────────────

/**
 * Estudiante reserva una sala.
 * @param roomPrismaId ID de la sala en Prisma
 * @param date Fecha de la reserva (se truncará a medianoche UTC)
 * @param startHour Hora de inicio (0-23)
 * @param duration Duración en horas (1-4)
 */
export async function bookRoom(
	roomPrismaId: string,
	date: string,
	startHour: number,
	duration: number,
) {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	try {
		if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
			throw new Error("Hora de inicio inválida (0-23)");
		}
		if (!Number.isInteger(duration) || duration < 1 || duration > 4) {
			throw new Error("Duración inválida (1-4 horas)");
		}
		if (startHour + duration > 24) {
			throw new Error("La reserva excede las 24:00");
		}

		const room = await prisma.room.findUnique({ where: { id: roomPrismaId } });
		if (!room || !room.active) throw new Error("Sala no encontrada o inactiva");

		const dateObj = new Date(date);
		const midnightTs = dateToMidnightTimestamp(dateObj);

		// Verificar si el estudiante ya tiene reserva para ese día (antes de gastar gas)
		const dateForCheck = new Date(date);
		dateForCheck.setUTCHours(0, 0, 0, 0);
		const existingBooking = await prisma.roomBooking.findFirst({
			where: {
				...ONLY_LIVE,
				userId: session.userId!,
				date: dateForCheck,
				cancelled: false,
			},
		});
		if (existingBooking) {
			throw new Error("Ya tienes una reserva para este día. Solo puedes reservar 1 sala al día.");
		}

		// Leer nextBookingId antes de crear
		const nextBookingId = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.roomBooking as `0x${string}`,
			abi: ROOM_BOOKING_ABI,
			functionName: "nextBookingId",
		}) as bigint;
		const bookingId = Number(nextBookingId);

		// Firmar con wallet del estudiante
		const { walletClient } = await getUserWalletClient(session.userId!);

		const hash = await walletClient.writeContract({
			address: CONTRACT_ADDRESSES.roomBooking as `0x${string}`,
			abi: ROOM_BOOKING_ABI,
			functionName: "bookRoom",
			args: [BigInt(room.roomId), midnightTs, startHour, duration],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });

		if (receipt.status !== "success") {
			throw new Error("La transacción fue revertida");
		}

		// Guardar en Prisma
		const dateForPrisma = new Date(date);
		dateForPrisma.setUTCHours(0, 0, 0, 0);

		const booking = await prisma.roomBooking.create({
			data: {
				bookingId,
				roomId: room.id,
				userId: session.userId!,
				date: dateForPrisma,
				startHour,
				duration,
				txHash: hash,
			},
		});

		// ── Recompensa por reserva ───────────────────────────────────────────
		let rewards: RewardGrant[] = [];
		const student = await prisma.user.findUnique({
			where: { id: session.userId! },
			select: { address: true },
		});
		if (student) {
			rewards = await issueReward({
				userId: session.userId!,
				userAddress: student.address,
				mainReason: ShopTokenRewardReason.ROOM_BOOKED,
				firstUseReason: ShopTokenRewardReason.MODULE_FIRST_USE_ROOMS,
			});
		}

		return { success: true, booking, rewards };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		if (isContractPauseError(error)) throw translateContractError(error, "Salas");
		throw new Error(`Error al reservar sala: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Cancela una reserva (estudiante propietario o bibliotecario/admin).
 */
export async function cancelBooking(bookingPrismaId: string) {
	const session = await getSession();
	if (!session.userId) throw new Error("No autenticado");

	try {
		const booking = await prisma.roomBooking.findUnique({ where: { id: bookingPrismaId } });
		if (!booking) throw new Error("Reserva no encontrada");
		if (booking.cancelled) throw new Error("La reserva ya está cancelada");
		ensureOnChainId(booking, "bookingId", "Reserva");

		// Verificar permisos
		const isOwner = booking.userId === session.userId;
		const isStaff = session.role === "LIBRARIAN" || session.role === "ADMIN";
		if (!isOwner && !isStaff) throw new Error("No autorizado");

		// Decidir quién firma la transacción
		let hash: `0x${string}`;
		if (isOwner) {
			const { walletClient } = await getUserWalletClient(session.userId!);
			hash = await walletClient.writeContract({
				address: CONTRACT_ADDRESSES.roomBooking as `0x${string}`,
				abi: ROOM_BOOKING_ABI,
				functionName: "cancelBooking",
				args: [BigInt(booking.bookingId)],
			});
		} else {
			hash = await adminWalletClient.writeContract({
				address: CONTRACT_ADDRESSES.roomBooking as `0x${string}`,
				abi: ROOM_BOOKING_ABI,
				functionName: "cancelBooking",
				args: [BigInt(booking.bookingId)],
			});
		}

		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") {
			throw new Error("La transacción fue revertida");
		}

		await prisma.roomBooking.update({
			where: { id: bookingPrismaId },
			data: { cancelled: true },
		});

		return { success: true };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		throw new Error(`Error al cancelar reserva: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Obtiene la disponibilidad de una sala para un día dado.
 * Devuelve un array de 24 booleanos (uno por hora, true = disponible).
 */
export async function getRoomAvailability(roomPrismaId: string, date: string) {
	const session = await getSession();
	if (!session.userId) throw new Error("No autenticado");

	const room = await prisma.room.findUnique({ where: { id: roomPrismaId } });
	if (!room) throw new Error("Sala no encontrada");

	const midnightTs = dateToMidnightTimestamp(new Date(date));

	try {
		// Intentar leer on-chain (rango 0-24 = todas las horas)
		const available = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.roomBooking as `0x${string}`,
			abi: ROOM_BOOKING_ABI,
			functionName: "getRoomAvailability",
			args: [BigInt(room.roomId), midnightTs, 0, 24],
		}) as boolean[];

		return available;
	} catch {
		// Fallback: calcular desde Prisma
		const dateObj = new Date(date);
		dateObj.setUTCHours(0, 0, 0, 0);

		const bookings = await prisma.roomBooking.findMany({
			where: {
				...ONLY_LIVE,
				roomId: room.id,
				date: dateObj,
				cancelled: false,
			},
		});

		const availability = Array(24).fill(true);
		for (const b of bookings) {
			for (let h = b.startHour; h < b.startHour + b.duration; h++) {
				availability[h] = false;
			}
		}
		return availability;
	}
}

/**
 * Obtiene las reservas del estudiante actual.
 */
export async function getMyBookings() {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	const bookings = await prisma.roomBooking.findMany({
		where: { userId: session.userId! },
		include: {
			room: { select: { id: true, name: true, location: true, capacity: true } },
		},
		orderBy: { date: "desc" },
	});

	return bookings;
}

/**
 * Lista todas las reservas con filtros opcionales.
 * Acceso: LIBRARIAN, ADMIN.
 */
export async function listBookings(filters?: {
	roomId?: string;
	date?: string;
	cancelled?: boolean;
	limit?: number;
	offset?: number;
}) {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	const where: Record<string, unknown> = { ...ONLY_LIVE };
	if (filters?.roomId) where.roomId = filters.roomId;
	if (filters?.cancelled !== undefined) where.cancelled = filters.cancelled;
	if (filters?.date) {
		const dateObj = new Date(filters.date);
		dateObj.setUTCHours(0, 0, 0, 0);
		where.date = dateObj;
	}

	const [bookings, total] = await Promise.all([
		prisma.roomBooking.findMany({
			where,
			include: {
				room: { select: { id: true, name: true, location: true } },
				user: { select: { id: true, name: true, email: true } },
			},
			orderBy: { date: "desc" },
			...(filters?.limit ? { take: filters.limit } : {}),
			...(filters?.offset ? { skip: filters.offset } : {}),
		}),
		prisma.roomBooking.count({ where }),
	]);

	return { items: bookings, total };
}

/**
 * Estadísticas de salas para el dashboard.
 * Acceso: LIBRARIAN, ADMIN.
 */
export async function getRoomStats() {
	const session = await getSession();
	ensureRole(session, ["LIBRARIAN", "ADMIN"]);

	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);

	const [totalRooms, activeRooms, totalBookings, todayBookings, cancelledBookings] = await Promise.all([
		prisma.room.count(),
		prisma.room.count({ where: { active: true } }),
		prisma.roomBooking.count({ where: { cancelled: false } }),
		prisma.roomBooking.count({
			where: { date: today, cancelled: false },
		}),
		prisma.roomBooking.count({ where: { cancelled: true } }),
	]);

	return {
		totalRooms,
		activeRooms,
		totalBookings,
		todayBookings,
		cancelledBookings,
	};
}
