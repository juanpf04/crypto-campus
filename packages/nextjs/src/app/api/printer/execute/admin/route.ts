/**
 * POST /api/printer/execute/admin
 * Ejecuta un trabajo de impresión en nombre de un usuario.
 * Acceso: Solo administradores.
 * Body: { userId, printerId, filename, pages, copies? }
 */

import { NextRequest, NextResponse } from "next/server";
import { executePrintJobAsAdmin } from "@/actions/printing";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function POST(req: NextRequest) {
	try {
		// Validar sesión y rol
		const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
		if (!session.userId || session.role !== "ADMIN") {
			return NextResponse.json({ error: "No autorizado" }, { status: 403 });
		}

		const body = await req.json();
		const { userId, printerId, filename, pages, copies } = body;

		if (!userId || !printerId || !filename || !pages) {
			return NextResponse.json(
				{ error: "campos requeridos: userId, printerId, filename, pages" },
				{ status: 400 }
			);
		}

		const result = await executePrintJobAsAdmin({
			userId,
			printerId,
			filename,
			pages,
			copies,
		});

		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		console.error("[POST /api/printer/execute/admin]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error al ejecutar trabajo de impresión admin" },
			{ status: 500 }
		);
	}
}
