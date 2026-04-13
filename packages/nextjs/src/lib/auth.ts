/**
 * auth.ts — Utilidades centralizadas de autenticación y autorización.
 *
 * Punto único para gestionar sesiones, verificar roles y logging de resiliencia.
 * Usado por Server Actions, API Routes y Middleware.
 */

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

export type Role = "STUDENT" | "PROFESSOR" | "LIBRARIAN" | "ADMIN";

/**
 * Obtiene la sesión desde cookies (para Server Actions y API Routes).
 */
export async function getSession() {
	return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/**
 * Obtiene la sesión desde request/response (para Middleware).
 */
export async function getRequestSession(req: NextRequest, res: NextResponse) {
	return getIronSession<SessionData>(req, res, sessionOptions);
}

/**
 * Verifica que el usuario está autenticado.
 * @throws "No autenticado" si no hay sesión.
 */
export function ensureAuthenticated(session: SessionData) {
	if (!session.userId) {
		throw new Error("No autenticado");
	}
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
 * Shortcut: verifica que el usuario es ADMIN.
 */
export function ensureAdmin(session: SessionData) {
	ensureRole(session, ["ADMIN"]);
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
