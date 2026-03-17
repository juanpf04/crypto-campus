/**
 * PUT /api/printer/[id]
 * Actualiza detalles de una impresora existente.
 * Acceso: Solo administradores.
 * Body: { name?, location?, floor?, active? } (campos opcionales)
 */

import { NextRequest, NextResponse } from "next/server";
import { updatePrinter } from "@/actions/printing";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		// Validar sesión y rol
		const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
		if (!session.userId || session.role !== "ADMIN") {
			return NextResponse.json({ error: "No autorizado" }, { status: 403 });
		}

		const { id } = await params;
		const body = await req.json();

		const printer = await updatePrinter({ id, ...body });
		return NextResponse.json(printer);
	} catch (error) {
		console.error("[PUT /api/printer/[id]]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error al actualizar impresora" },
			{ status: 500 }
		);
	}
}
