/**
 * PUT /api/printer/[id]
 * Actualiza detalles de una impresora existente.
 * Acceso: Solo administradores (validado en la Server Action).
 * Body: { name?, location?, floor?, active? } (campos opcionales)
 */

import { NextRequest, NextResponse } from "next/server";
import { updatePrinter } from "@/actions/printing";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id } = await params;
		const body = await req.json();

		// Desestructurar solo los campos válidos para evitar pasar datos inesperados
		const { name, location, floor, active } = body;

		const printer = await updatePrinter({ id, name, location, floor, active });
		return NextResponse.json(printer);
	} catch (error) {
		console.error("[PUT /api/printer/[id]]", error);
		const message = error instanceof Error ? error.message : "Error al actualizar impresora";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
