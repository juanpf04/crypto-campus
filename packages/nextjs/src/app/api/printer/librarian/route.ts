/**
 * GET /api/printer/librarian
 * Lista todas las impresoras registradas (activas e inactivas).
 * Acceso: Bibliotecarios y admins (validado en la Server Action).
 */

import { NextResponse } from "next/server";
import { listAllPrinters } from "@/actions/printing";

export async function GET() {
	try {
		const printers = await listAllPrinters();
		return NextResponse.json(printers);
	} catch (error) {
		console.error("[GET /api/printer/librarian]", error);
		const message = error instanceof Error ? error.message : "Error al listar impresoras";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
