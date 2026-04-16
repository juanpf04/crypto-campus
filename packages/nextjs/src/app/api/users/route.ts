/**
 * GET /api/users
 * Lista usuarios (datos básicos).
 * Acceso: ADMIN, LIBRARIAN.
 */

import { NextResponse } from "next/server";
import { getSession, ensureRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
	try {
		const session = await getSession();
		ensureRole(session, ["ADMIN", "LIBRARIAN"]);

		const users = await prisma.user.findMany({
			select: { id: true, email: true, name: true, role: true },
			orderBy: { name: "asc" },
		});

		return NextResponse.json({ users });
	} catch (error) {
		console.error("[GET /api/users]", error);
		const message = error instanceof Error ? error.message : "Error al listar usuarios";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
