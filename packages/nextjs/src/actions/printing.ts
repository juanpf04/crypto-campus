/**
 * printer.ts — Server Actions para el contrato Printer.
 *
 * Este módulo gestiona todas las operaciones relacionadas con el sistema de
 * impresión on-chain (créditos, trabajos de impresión, impresoras fisicas).
 *
 * Funcionalidades principales:
 * - Lectura de configuración del contrato Printer (INITIAL_CREDITS, campusRoles).
 * - Consulta y actualización de créditos de impresión (on-chain).
 * - Ejecución de trabajos de impresión (consumo de créditos).
 * - Gestión de impresoras físicas en BD (create, update, list).
 * - Logs de cada impresión ejecutada (txHash + BD).
 *
 * Control de acceso:
 * - Estudiantes: pueden leer sus propios créditos y ejecutar trabajos de impresión.
 * - Admins: pueden ver/modificar créditos de cualquier estudiante y gestionar impresoras.
 */

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, ensureRole } from "@/lib/auth";
import { adminWalletClient, publicClient } from "@/lib/viem";
import { CONTRACT_ADDRESSES, PRINTER_ABI } from "@/lib/contracts";
import { issueReward, hasRewardOfType, ShopTokenRewardReason, type RewardGrant } from "@/lib/shopRewards";

interface ExecutePrintInput {
	printerId: string;
	filename: string;
	pages: number;
	copies?: number;
	color?: boolean;
	duplex?: boolean;
	orientation?: string;
	paperSize?: string;
	pageRangeFrom?: number | null;
	pageRangeTo?: number | null;
	pagesPerSheet?: number;
	filePages?: number;
	fileSize?: number;
	filePath?: string | null;
}

function ensurePositiveInt(value: number, fieldName: string): number {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${fieldName} debe ser un entero positivo`);
	}
	return value;
}

/**
 * Valida que un valor sea un entero no negativo (>= 0).
 * Usado para créditos, donde 0 es un valor válido (quitar todos los créditos).
 * @throws Error si no es entero no negativo.
 */
function ensureNonNegativeInt(value: number, fieldName: string): number {
	if (!Number.isInteger(value) || value < 0) {
		throw new Error(`${fieldName} debe ser un entero no negativo`);
	}
	return value;
}

/**
 * Normaliza y valida que un string no esté vacío después de trim.
 * @throws Error si está vacío o solo contiene espacios.
 */
function cleanString(value: string, fieldName: string): string {
	const normalized = value.trim();
	if (!normalized) {
		throw new Error(`${fieldName} es obligatorio`);
	}
	return normalized;
}

/**
 * Obtiene la dirección Ethereum de un usuario por su ID en la BD.
 * @throws Error si el usuario no existe.
 */
async function getUserAddressById(userId: string): Promise<string> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { address: true },
	});

	if (!user) {
		throw new Error("Usuario no encontrado");
	}

	return user.address;
}

/**
 * Lee los créditos disponibles de una dirección Ethereum en el contrato Printer.
 * @returns Créditos como bigint (o -1 si no es estudiante).
 */
async function readCredits(address: string): Promise<bigint> {
	try {
		return await publicClient.readContract({
			address: CONTRACT_ADDRESSES.printer,
			abi: PRINTER_ABI,
			functionName: "getCredits",
			args: [address],
		}) as bigint;
	} catch (error) {
		throw new Error(`Error al leer créditos: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Obtiene la configuración de inicialización del contrato Printer.
 * @returns Dirección del contrato, campusRoles y créditos iniciales por estudiante.
 */
export async function getPrinterConfig() {
	try {
		const [initialCredits, campusRoles] = await Promise.all([
			publicClient.readContract({
				address: CONTRACT_ADDRESSES.printer,
				abi: PRINTER_ABI,
				functionName: "INITIAL_CREDITS",
			}) as Promise<bigint>,
			publicClient.readContract({
				address: CONTRACT_ADDRESSES.printer,
				abi: PRINTER_ABI,
				functionName: "campusRoles",
			}) as Promise<`0x${string}`>,
		]);

		return {
			contractAddress: CONTRACT_ADDRESSES.printer,
			campusRoles,
			initialCredits: Number(initialCredits),
		};
	} catch (error) {
		throw new Error(`Error al obtener configuración del contrato: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lista todas las impresoras activas registradas en la BD.
 * @returns Array de impresoras ordenadas por ubicación.
 */
export async function listActivePrinters() {
	try {
		return await prisma.printer.findMany({
			where: { active: true },
			orderBy: [{ location: "asc" }, { id: "asc" }],
		});
	} catch (error) {
		throw new Error(`Error al listar impresoras: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lista los trabajos de impresión ejecutados por el usuario logueado.
 * Soporta paginación con limit + offset.
 *
 * @param limit Máximo número de registros a devolver (1–100, default 20).
 * @param offset Número de registros a saltar desde el inicio (default 0).
 * @returns Array de logs de impresión ordenados por fecha descendente.
 */
export async function listMyPrinterLogs(limit = 20, offset = 0) {
	const safeLimit = Math.min(Math.max(limit, 1), 100);
	const safeOffset = Math.max(offset, 0);

	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR", "LIBRARIAN", "ADMIN"]);

	try {
		return await prisma.printLog.findMany({
			where: { userId: session.userId },
			include: {
				printer: {
					select: { id: true, location: true },
				},
			},
			orderBy: { createdAt: "desc" },
			take: safeLimit,
			skip: safeOffset,
		});
	} catch (error) {
		throw new Error(`Error al obtener logs de impresión: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Obtiene el detalle de un trabajo de impresión individual.
 * El usuario solo puede ver sus propios logs. Los admins pueden ver cualquiera.
 *
 * @param logId ID del PrintLog.
 * @returns Detalle completo del log con datos de impresora y (si admin) usuario.
 */
export async function getPrintLogDetail(logId: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR", "LIBRARIAN", "ADMIN"]);

	try {
		const log = await prisma.printLog.findUnique({
			where: { id: logId },
			include: {
				user: {
					select: { id: true, name: true, email: true, role: true },
				},
				printer: {
					select: { id: true, location: true },
				},
			},
		});

		if (!log) throw new Error("Log no encontrado");

		// Los no-admin/librarian solo pueden ver sus propios logs
		if (session.role !== "ADMIN" && session.role !== "LIBRARIAN" && log.userId !== session.userId) {
			throw new Error("No autorizado");
		}

		return log;
	} catch (error) {
		if (error instanceof Error && (error.message === "No autorizado" || error.message === "Log no encontrado")) {
			throw error;
		}
		throw new Error(`Error al obtener detalle del log: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lista todos los trabajos de impresión del sistema (solo para admins).
 * Soporta paginación con limit + offset y filtro opcional por usuario.
 *
 * @param limit Máximo número de registros a devolver (1–200, default 50).
 * @param offset Número de registros a saltar desde el inicio (default 0).
 * @param userId ID de usuario opcional para filtrar logs de un usuario concreto.
 * @returns Array de logs con detalles de usuario e impresora.
 */
export async function listPrinterLogsForAdmin(limit = 50, offset = 0, userId?: string) {
	const safeLimit = Math.min(Math.max(limit, 1), 200);
	const safeOffset = Math.max(offset, 0);

	const session = await getSession();
	ensureRole(session, ["ADMIN", "LIBRARIAN"]);

	try {
		// Si se pasa userId, filtrar solo los logs de ese usuario
		const where = userId ? { userId } : {};

		return await prisma.printLog.findMany({
			where,
			include: {
				user: {
					select: { id: true, name: true, email: true, role: true, address: true },
				},
				printer: {
					select: { id: true, location: true },
				},
			},
			orderBy: { createdAt: "desc" },
			take: safeLimit,
			skip: safeOffset,
		});
	} catch (error) {
		throw new Error(`Error al obtener logs globales de impresión: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lista todas las impresoras registradas en la BD (activas e inactivas).
 * Solo accesible por administradores, para gestión completa de impresoras.
 *
 * @returns Array de impresoras ordenadas por ubicación.
 */
export async function listAllPrinters() {
	const session = await getSession();
	ensureRole(session, ["ADMIN", "LIBRARIAN"]);

	try {
		return await prisma.printer.findMany({
			orderBy: [{ location: "asc" }, { id: "asc" }],
		});
	} catch (error) {
		throw new Error(`Error al listar impresoras: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Registra una nueva impresora física en la BD (solo admin).
 * La impresora se activa por defecto.
 *
 * @param input Identificador único y ubicación de la impresora.
 * @returns Registro creado con timestamps.
 */
export async function createPrinter(input: { id: string; location: string }) {
	const session = await getSession();
	ensureRole(session, ["ADMIN", "LIBRARIAN"]);

	try {
		const id = cleanString(input.id, "El identificador");
		const location = cleanString(input.location, "La ubicación");

		// Crear registro en BD con estado activo por defecto
		const printer = await prisma.printer.create({
			data: { id, location, active: true },
		});

		// Revalidar caché de la ruta de administración
		revalidatePath("/admin/printing");
		return printer;
	} catch (error) {
		if (error instanceof Error && error.message.includes("Unique constraint failed")) {
			throw new Error("Ya existe una impresora con ese identificador");
		}
		throw new Error(`Error al registrar impresora: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Actualiza los detalles de una impresora existente (solo admin).
 * Modifica ubicación o estado activo.
 *
 * @param input ID de la impresora y campos a actualizar (solo los proporcionados se modifican).
 * @returns Impresora actualizada con nuevos valores.
 */
export async function updatePrinter(input: { id: string; location?: string; active?: boolean }) {
	const session = await getSession();
	ensureRole(session, ["ADMIN", "LIBRARIAN"]);

	try {
		const id = cleanString(input.id, "El identificador");

		// Verificar que la impresora existe
		const existing = await prisma.printer.findUnique({
			where: { id },
		});

		if (!existing) {
			throw new Error("Impresora no encontrada");
		}

		// Preparar datos a actualizar, validando solo los campos proporcionados
		const updates: {
			location?: string;
			active?: boolean;
		} = {};

		if (typeof input.location === "string") {
			updates.location = cleanString(input.location, "La ubicación");
		}
		if (typeof input.active === "boolean") {
			updates.active = input.active;
		}

		// Actualizar registro en BD
		const printer = await prisma.printer.update({
			where: { id },
			data: updates,
		});

		// Revalidar caché
		revalidatePath("/admin/printing");
		return printer;
	} catch (error) {
		if (error instanceof Error && error.message.includes("Unique constraint failed")) {
			throw new Error("Ya existe otra impresora con ese identificador");
		}
		throw new Error(`Error al actualizar impresora: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Obtiene los créditos de impresión disponibles para el usuario logueado.
 * @returns Dirección del usuario, créditos disponibles, e indicador si es estudiante.
 */
export async function getMyPrinterCredits() {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR", "LIBRARIAN", "ADMIN"]);

	try {
		const user = await prisma.user.findUnique({
			where: { id: session.userId },
			select: { address: true },
		});

		if (!user) {
			throw new Error("Usuario no encontrado en la base de datos");
		}

		const credits = await readCredits(user.address);
		return {
			userAddress: user.address,
			availableCredits: Number(credits),
			isStudent: credits >= BigInt(0),
		};
	} catch (error) {
		throw new Error(`Error al obtener créditos personales: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Obtiene los créditos de impresión de un estudiante (solo admin).
 * @param userId ID del estudiante en la BD.
 * @returns Dirección del estudiante, créditos disponibles, e indicador si es estudiante.
 */
export async function getStudentPrinterCredits(userId: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const address = await getUserAddressById(userId);
		const credits = await readCredits(address);

		return {
			userId,
			userAddress: address,
			availableCredits: Number(credits),
			isStudent: credits >= BigInt(0),
		};
	} catch (error) {
		throw new Error(`Error al obtener créditos del estudiante: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Asigna una cantidad de créditos a un estudiante (solo admin).
 * Escribe en el contrato Printer y aguarda confirmación de la transacción.
 *
 * @param userId ID del estudiante en la BD.
 * @param credits Cantidad exacta de créditos a asignar.
 * @returns Hash de la transacción, ID del usuario, dirección y créditos actualizados.
 */
export async function setStudentPrinterCredits(userId: string, credits: number) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const normalizedCredits = ensureNonNegativeInt(credits, "Los créditos");
		const address = await getUserAddressById(userId);

		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.printer,
			abi: PRINTER_ABI,
			functionName: "setCredits",
			args: [address, BigInt(normalizedCredits)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });

		if (receipt.status !== "success") {
			throw new Error("La transacción de asignación de créditos fue revertida");
		}

		const updatedCredits = await readCredits(address);

		return {
			txHash: hash,
			userId,
			userAddress: address,
			credits: Number(updatedCredits),
		};
	} catch (error) {
		throw new Error(`Error al asignar créditos: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lógica compartida para ejecutar un trabajo de impresión.
 * Valida la impresora, consume créditos en el contrato y registra en BD.
 *
 * @internal Uso solo desde executeMyPrintJob.
 */
async function executePrinterJob(
	userId: string,
	userAddress: string,
	input: ExecutePrintInput,
) {
	// Validar y normalizar entradas
	const printerId = cleanString(input.printerId, "La impresora");
	const filename = cleanString(input.filename, "El nombre del archivo");
	const pages = ensurePositiveInt(input.pages, "Las páginas");
	const copies = ensurePositiveInt(input.copies ?? 1, "Las copias");
	const pagesToPrint = pages * copies;

	if (pagesToPrint > 50) {
		throw new Error("Máximo 50 páginas por trabajo de impresión");
	}

	// Verificar que la impresora existe y está activa en BD
	const printer = await prisma.printer.findUnique({
		where: { id: printerId },
		select: { id: true, active: true },
	});

	if (!printer || !printer.active) {
		throw new Error("Impresora no disponible");
	}

	// Ejecutar transacción en blockchain: consume créditos y emite evento
	try {
		const txHash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.printer,
			abi: PRINTER_ABI,
			functionName: "print",
			args: [userAddress, BigInt(pagesToPrint)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

		if (receipt.status !== "success") {
			throw new Error("La transacción de impresión fue revertida");
		}

		// Leer créditos actualizados post-transacción
		const creditsAfter = await readCredits(userAddress);
		const normalizedCreditsAfter = Math.min(Number(creditsAfter), 2147483647);

		const fullPrintLogData = {
			userId,
			printerId,
			filename,
			pages: pagesToPrint,
			copies,
			txHash,
			creditsUsed: pagesToPrint,
			creditsAfter: normalizedCreditsAfter,
			color: input.color ?? false,
			duplex: input.duplex ?? false,
			orientation: input.orientation ?? "portrait",
			paperSize: input.paperSize ?? "A4",
			pageRangeFrom: input.pageRangeFrom ?? null,
			pageRangeTo: input.pageRangeTo ?? null,
			pagesPerSheet: input.pagesPerSheet ?? 1,
			filePages: input.filePages ?? pagesToPrint,
			fileSize: input.fileSize ?? 0,
			filePath: input.filePath ?? null,
		};

		const minimalPrintLogData = {
			userId,
			printerId,
			filename,
			pages: pagesToPrint,
			txHash,
			creditsUsed: pagesToPrint,
			creditsAfter: normalizedCreditsAfter,
		};

		// Registrar el evento en BD con información de créditos, transacción y opciones de impresión
		let printLog;
		try {
			printLog = await prisma.printLog.create({
				data: fullPrintLogData,
				include: {
					printer: {
						select: { id: true, location: true },
					},
				},
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : "";
			const hasUnknownArgument = message.includes("Unknown argument") || message.includes("Invalid `") && message.includes(".printLog.create(");

			if (!hasUnknownArgument) {
				throw error;
			}

			// Compatibilidad con clientes Prisma desalineados que aún no incluyen campos nuevos de PrintLog.
			printLog = await prisma.printLog.create({
				data: minimalPrintLogData,
				include: {
					printer: {
						select: { id: true, location: true },
					},
				},
			});
		}

		return {
			txHash,
			printLog,
		};
	} catch (error) {
		throw new Error(`Error al ejecutar trabajo de impresión: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Ejecuta un trabajo de impresión para el usuario logueado.
 * Consume créditos en el contrato Printer y registra el evento en la BD.
 *
 * @param input Especificación del trabajo: ID de impresora, páginas, nombre de archivo, (opcional) copias.
 * @returns Hash de transacción y detalles del log de impresión.
 */
export async function executeMyPrintJob(input: ExecutePrintInput) {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR", "LIBRARIAN", "ADMIN"]);

	try {
		const user = await prisma.user.findUnique({
			where: { id: session.userId },
			select: { id: true, address: true },
		});

		if (!user) {
			throw new Error("Usuario no encontrado en la base de datos");
		}

		// Ejecutar trabajo y luego revalidar caché de ruta de estudiante
		const result = await executePrinterJob(user.id, user.address, input);
		revalidatePath("/student/library/printing");

		// ── Recompensa por impresión (solo estudiantes) ──────────────────────
		let rewards: RewardGrant[] = [];
		if (session.role === "STUDENT") {
			const pages = Math.max(1, input.pages);
			const copies = Math.max(1, input.copies ?? 1);
			const rewardAmount = Math.floor((pages * copies) / 10);
			if (rewardAmount > 0) {
				rewards = await issueReward({
					userId: user.id,
					userAddress: user.address,
					mainReason: ShopTokenRewardReason.PRINT_JOB,
					mainAmount: rewardAmount,
					firstUseReason: ShopTokenRewardReason.MODULE_FIRST_USE_PRINTING,
				});
			} else {
				const hasPrinting = await hasRewardOfType(user.id, ShopTokenRewardReason.MODULE_FIRST_USE_PRINTING);
				if (!hasPrinting) {
					rewards = await issueReward({
						userId: user.id,
						userAddress: user.address,
						mainReason: ShopTokenRewardReason.MODULE_FIRST_USE_PRINTING,
						mainAmount: 2,
					});
				}
			}
		}

		return { ...result, rewards };
	} catch (error) {
		throw new Error(`Error al ejecutar trabajo personal: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Devuelve el conteo de páginas impresas por mes del usuario autenticado
 * en los últimos 6 meses (incluyendo el mes actual).
 * Retorna array de { month: "abr 2026", count: number } en orden cronológico.
 */
export async function getMyPrintsByMonth(): Promise<{ month: string; count: number }[]> {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR", "LIBRARIAN", "ADMIN"]);

	// Seis meses contando el actual, inicio del mes más antiguo
	const now = new Date();
	const startMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);

	const logs = await prisma.printLog.findMany({
		where: {
			userId: session.userId!,
			createdAt: { gte: startMonth },
		},
		select: { pages: true, createdAt: true },
	});

	// Agrupar por "YYYY-MM"
	const buckets = new Map<string, number>();
	for (let i = 0; i < 6; i++) {
		const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
		buckets.set(key, 0);
	}

	for (const l of logs) {
		const d = l.createdAt;
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
		if (buckets.has(key)) buckets.set(key, buckets.get(key)! + l.pages);
	}

	return Array.from(buckets.entries()).map(([key, count]) => {
		const [year, month] = key.split("-");
		const d = new Date(Number(year), Number(month) - 1, 1);
		return {
			month: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
			count,
		};
	});
}
