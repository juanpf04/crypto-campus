/**
 * POST /api/printer/execute
 * Ejecuta un trabajo de impresión para el usuario logueado.
 * Acceso: Usuarios autenticados.
 * Body: { printerId, filename, pages, copies? }
 */

import { NextRequest, NextResponse } from "next/server";
import { executeMyPrintJob } from "@/actions/printing";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function POST(req: NextRequest) {
	try {
		// Validar sesión
		const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
		if (!session.userId) {
			return NextResponse.json({ error: "No autenticado" }, { status: 401 });
		}

		const body = await req.json();
		const { printerId, filename, pages, copies } = body;

		if (!printerId || !filename || !pages) {
			return NextResponse.json(
				{ error: "campos requeridos: printerId, filename, pages" },
				{ status: 400 }
			);
		}

		const result = await executeMyPrintJob({
			printerId,
			filename,
			pages,
			copies,
		});

		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		console.error("[POST /api/printer/execute]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error al ejecutar trabajo de impresión" },
			{ status: 500 }
		);
	}
}
