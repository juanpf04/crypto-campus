/**
 * GET /api/printer
 * Lista todas las impresoras activas.
 * Acceso: Público (solo lectura).
 *
 * POST /api/printer
 * Registra una nueva impresora física.
 * Acceso: Solo administradores (validado en la Server Action).
 * Body: { id, name, location, floor? }
 */

import { NextRequest, NextResponse } from "next/server";
import { createPrinter, listActivePrinters } from "@/actions/printing";

export async function GET() {
	try {
		const printers = await listActivePrinters();
		return NextResponse.json(printers);
	} catch (error) {
		console.error("[GET /api/printer]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error al listar impresoras" },
			{ status: 500 }
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { id, name, location, floor } = body;

		// Validar campos requeridos (la autorización la valida createPrinter)
		if (!id || !name || !location) {
			return NextResponse.json(
				{ error: "campos requeridos: id, name, location" },
				{ status: 400 }
			);
		}

		const printer = await createPrinter({ id, name, location, floor });
		return NextResponse.json(printer, { status: 201 });
	} catch (error) {
		console.error("[POST /api/printer]", error);
		const message = error instanceof Error ? error.message : "Error al crear impresora";
		const status = message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
