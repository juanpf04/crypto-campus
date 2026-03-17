/**
 * GET /api/printer/credits/[userId]
 * Obtiene los créditos de impresión de un estudiante específico.
 * Acceso: Solo administradores.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStudentPrinterCredits } from "@/actions/printing";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
	try {
		// Validar sesión y rol
		const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
		if (!session.userId || session.role !== "ADMIN") {
			return NextResponse.json({ error: "No autorizado" }, { status: 403 });
		}

		const { userId } = await params;
		const credits = await getStudentPrinterCredits(userId);
		return NextResponse.json(credits);
	} catch (error) {
		console.error("[GET /api/printer/credits/[userId]]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error al obtener créditos del estudiante" },
			{ status: 500 }
		);
	}
}
