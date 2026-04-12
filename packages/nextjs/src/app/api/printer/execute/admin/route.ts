/**
 * POST /api/printer/execute/admin
 * Ejecuta un trabajo de impresión en nombre de un usuario.
 * Acceso: Solo administradores (validado en la Server Action).
 * Body: { userId, printerId, filename, pages, copies? }
 */

import { NextRequest, NextResponse } from "next/server";
import { executePrintJobAsAdmin } from "@/actions/printing";

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { userId, printerId, filename, pages, copies } = body;

		// Validar campos requeridos (la autorización la valida executePrintJobAsAdmin)
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
		const message = error instanceof Error ? error.message : "Error al ejecutar trabajo de impresión admin";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
