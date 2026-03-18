/**
 * GET /api/printer/credits
 * Obtiene los créditos de impresión del usuario logueado.
 * Acceso: Usuarios autenticados (validado en la Server Action).
 *
 * POST /api/printer/credits
 * Asigna créditos a un estudiante.
 * Acceso: Solo administradores (validado en la Server Action).
 * Body: { userId, credits }
 */

import { NextRequest, NextResponse } from "next/server";
import { getMyPrinterCredits, setStudentPrinterCredits } from "@/actions/printing";

export async function GET() {
	try {
		const credits = await getMyPrinterCredits();
		return NextResponse.json(credits);
	} catch (error) {
		console.error("[GET /api/printer/credits]", error);
		const message = error instanceof Error ? error.message : "Error al obtener créditos";
		const status = message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { userId, credits } = body;

		// Validar campos requeridos (la autorización la valida setStudentPrinterCredits)
		if (!userId || credits === undefined) {
			return NextResponse.json(
				{ error: "campos requeridos: userId, credits" },
				{ status: 400 }
			);
		}

		const result = await setStudentPrinterCredits(userId, credits);
		return NextResponse.json(result);
	} catch (error) {
		console.error("[POST /api/printer/credits]", error);
		const message = error instanceof Error ? error.message : "Error al asignar créditos";
		const status = message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
