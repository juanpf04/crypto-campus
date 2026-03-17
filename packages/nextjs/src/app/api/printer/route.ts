/**
 * GET /api/printer
 * Lista todas las impresoras activas.
 * Acceso: Público (solo lectura).
 *
 * POST /api/printer
 * Registra una nueva impresora física.
 * Acceso: Solo administradores.
 * Body: { id, name, location, floor? }
 */

import { NextRequest, NextResponse } from "next/server";
import { createPrinter, listActivePrinters } from "@/actions/printing";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

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
		// Validar sesión y rol
		const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
		if (!session.userId || session.role !== "ADMIN") {
			return NextResponse.json({ error: "No autorizado" }, { status: 403 });
		}

		const body = await req.json();
		const { id, name, location, floor } = body;

		// Validar campos requeridos
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
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error al crear impresora" },
			{ status: 500 }
		);
	}
}
