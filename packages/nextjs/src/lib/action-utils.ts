/**
 * action-utils.ts — Utilidades compartidas para Server Actions.
 *
 * Centraliza helpers de autenticación, autorización y resiliencia
 * que se repiten en todos los ficheros de actions.
 */

import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

type Role = "STUDENT" | "PROFESSOR" | "LIBRARIAN" | "ADMIN";

/**
 * Obtiene la sesión del usuario desde la cookie cifrada.
 */
export async function getSession() {
	return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/**
 * Verifica que el usuario tiene uno de los roles permitidos.
 * Distingue entre no autenticado (401) y no autorizado (403).
 */
export function ensureRole(session: SessionData, allowed: Role[]) {
	if (!session.userId) {
		throw new Error("No autenticado");
	}
	if (!session.role || !allowed.includes(session.role as Role)) {
		throw new Error("No autorizado");
	}
}

/**
 * Registra en consola un fallo de Prisma tras una transacción blockchain exitosa.
 * Permite reconciliación manual si la base de datos se desincroniza.
 */
export function logPrismaRecovery(
	operation: string,
	txHash: string,
	error: unknown,
) {
	console.error(
		`[RECOVERY] Prisma falló tras tx exitosa — operación: ${operation}, txHash: ${txHash}, error:`,
		error instanceof Error ? error.message : error,
	);
}
