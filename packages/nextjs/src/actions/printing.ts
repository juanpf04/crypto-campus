/**
 * printer.ts — Server Actions para el contrato Printer.
 *
 * Este módulo gestiona todas las operaciones relacionadas con el sistema de
 * impresión on-chain (créditos, trabajos de impresión, impresoras fisicas).
 *
 * Funcionalidades principales:
 * - Lectura de configuración del contrato Printer (INITIAL_CREDITS, accessControl).
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

import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionData } from "@/lib/session";
import { adminWalletClient, publicClient } from "@/lib/viem";
import { CONTRACT_ADDRESSES, PRINTER_ABI } from "@/lib/contracts";

type Role = "STUDENT" | "PROFESSOR" | "LIBRARIAN" | "ADMIN";

export interface CreatePrinterInput {
	id: string;
	name: string;
	location: string;
	floor?: string;
}

export interface UpdatePrinterInput {
	id: string;
	name?: string;
	location?: string;
	floor?: string;
	active?: boolean;
}

export interface ExecutePrintInput {
	printerId: string;
	filename: string;
	pages: number;
	copies?: number;
}

export interface ExecutePrintAsAdminInput extends ExecutePrintInput {
	userId: string;
}

/**
 * Obtiene la sesión del usuario actual desde la cookie cifrada.
 * @returns Sesión del usuario logueado o sesión vacía si no está autenticado.
 */
async function getSession() {
	return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/**
 * Valida que un valor sea un entero positivo.
 * @throws Error si no es entero positivo.
 */
function ensurePositiveInt(value: number, fieldName: string): number {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${fieldName} debe ser un entero positivo`);
	}
	return value;
}

/**
 * Verifica que el usuario actual tiene sesión activa y rol permitido.
 * @throws Error si no está autenticado o carece de permisos.
 */
function ensureRole(session: SessionData, allowed: Role[]) {
	if (!session.userId || !session.role || !allowed.includes(session.role as Role)) {
		throw new Error("No autorizado");
	}
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
		}) as Promise<bigint>;
	} catch (error) {
		throw new Error(`Error al leer créditos: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Obtiene la configuración de inicialización del contrato Printer.
 * @returns Dirección del contrato, accessControl y créditos iniciales por estudiante.
 */
export async function getPrinterConfig() {
	try {
		const [initialCredits, accessControl] = await Promise.all([
			publicClient.readContract({
				address: CONTRACT_ADDRESSES.printer,
				abi: PRINTER_ABI,
				functionName: "INITIAL_CREDITS",
			}) as Promise<bigint>,
			publicClient.readContract({
				address: CONTRACT_ADDRESSES.printer,
				abi: PRINTER_ABI,
				functionName: "accessControl",
			}) as Promise<`0x${string}`>,
		]);

		return {
			contractAddress: CONTRACT_ADDRESSES.printer,
			accessControl,
			initialCredits: Number(initialCredits),
		};
	} catch (error) {
		throw new Error(`Error al obtener configuración del contrato: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lista todas las impresoras activas registradas en la BD.
 * @returns Array de impresoras ordenadas por ubicación y nombre.
 */
export async function listActivePrinters() {
	try {
		return await prisma.printer.findMany({
			where: { active: true },
			orderBy: [{ location: "asc" }, { name: "asc" }],
		});
	} catch (error) {
		throw new Error(`Error al listar impresoras: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lista los trabajos de impresión ejecutados por el usuario logueado.
 * @param limit Máximo número de registros a devolver (limitado a 100).
 * @returns Array de logs de impresión ordenados por fecha descendente.
 */
export async function listMyPrinterLogs(limit = 20) {
	const safeLimit = Math.min(Math.max(limit, 1), 100);

	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR", "LIBRARIAN", "ADMIN"]);

	try {
		return await prisma.printLog.findMany({
			where: { userId: session.userId },
			include: {
				printer: {
					select: { id: true, name: true, location: true, floor: true },
				},
			},
			orderBy: { createdAt: "desc" },
			take: safeLimit,
		});
	} catch (error) {
		throw new Error(`Error al obtener logs de impresión: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lista todos los trabajos de impresión del sistema (solo para admins).
 * @param limit Máximo número de registros a devolver (limitado a 200).
 * @returns Array de logs con detalles de usuario e impresora.
 */
export async function listPrinterLogsForAdmin(limit = 50) {
	const safeLimit = Math.min(Math.max(limit, 1), 200);

	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		return await prisma.printLog.findMany({
			include: {
				user: {
					select: { id: true, name: true, email: true, role: true, address: true },
				},
				printer: {
					select: { id: true, name: true, location: true, floor: true },
				},
			},
			orderBy: { createdAt: "desc" },
			take: safeLimit,
		});
	} catch (error) {
		throw new Error(`Error al obtener logs globales de impresión: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Registra una nueva impresora física en la BD (solo admin).
 * La impresora se activa por defecto.
 *
 * @param input Identificador único, nombre, ubicación y piso de la impresora.
 * @returns Registro creado con timestamps.
 */
export async function createPrinter(input: CreatePrinterInput) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const id = cleanString(input.id, "El identificador");
		const name = cleanString(input.name, "El nombre");
		const location = cleanString(input.location, "La ubicación");
		const floor = input.floor?.trim() || null;

		// Crear registro en BD con estado activo por defecto
		const printer = await prisma.printer.create({
			data: { id, name, location, floor, active: true },
		});

		// Revalidar caché de la ruta de administración
		revalidatePath("/dashboard/admin/printing");
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
 * Modifica nombre, ubicación, piso o estado activo.
 *
 * @param input ID de la impresora y campos a actualizar (solo los proporcionados se modifican).
 * @returns Impresora actualizada con nuevos valores.
 */
export async function updatePrinter(input: UpdatePrinterInput) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

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
			name?: string;
			location?: string;
			floor?: string | null;
			active?: boolean;
		} = {};

		if (typeof input.name === "string") {
			updates.name = cleanString(input.name, "El nombre");
		}
		if (typeof input.location === "string") {
			updates.location = cleanString(input.location, "La ubicación");
		}
		if (typeof input.floor === "string") {
			updates.floor = input.floor.trim() || null;
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
		revalidatePath("/dashboard/admin/printing");
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
			isStudent: credits >= 0n,
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
			isStudent: credits >= 0n,
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
		const normalizedCredits = ensurePositiveInt(credits, "Los créditos");
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
 * @internal Uso solo desde executeMyPrintJob y executePrintJobAsAdmin.
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

		// Registrar el evento en BD con información de créditos y transacción
		const printLog = await prisma.printLog.create({
			data: {
				userId,
				printerId,
				filename,
				pages: pagesToPrint,
				txHash,
				creditsUsed: pagesToPrint,
				creditsAfter: Number(creditsAfter),
			},
			include: {
				printer: {
					select: { id: true, name: true, location: true, floor: true },
				},
			},
		});

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
		revalidatePath("/dashboard/student/printing");
		return result;
	} catch (error) {
		throw new Error(`Error al ejecutar trabajo personal: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Ejecuta un trabajo de impresión en nombre de un usuario (solo admin).
 * Consume créditos del usuario en el contrato y registra el evento.
 *
 * @param input Especificación del trabajo incluyendo ID del usuario, impresora, páginas y archivo.
 * @returns Hash de transacción y detalles del log de impresión.
 */
export async function executePrintJobAsAdmin(input: ExecutePrintAsAdminInput) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const user = await prisma.user.findUnique({
			where: { id: input.userId },
			select: { id: true, address: true },
		});

		if (!user) {
			throw new Error("Usuario no encontrado en la base de datos");
		}

		// Ejecutar trabajo en nombre del usuario y revalidar caché de admin
		const result = await executePrinterJob(user.id, user.address, input);
		revalidatePath("/dashboard/admin/printing");
		return result;
	} catch (error) {
		throw new Error(`Error al ejecutar trabajo de impresión admin: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}
