/**
 * GET /api/printer/credits/[userId]
 * Obtiene los créditos de impresión de un estudiante específico.
 * Acceso: Solo administradores (validado en la Server Action).
 */

import { NextRequest, NextResponse } from "next/server";
import { getStudentPrinterCredits } from "@/actions/printing";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
	try {
		const { userId } = await params;
		const credits = await getStudentPrinterCredits(userId);
		return NextResponse.json(credits);
	} catch (error) {
		console.error("[GET /api/printer/credits/[userId]]", error);
		const message = error instanceof Error ? error.message : "Error al obtener créditos del estudiante";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
