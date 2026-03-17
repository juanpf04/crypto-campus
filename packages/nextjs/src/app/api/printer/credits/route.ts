/**
 * GET /api/printer/credits
 * Obtiene los créditos de impresión del usuario logueado.
 * Acceso: Usuarios autenticados.
 *
 * POST /api/printer/credits
 * Asigna créditos a un estudiante.
 * Acceso: Solo administradores.
 * Body: { userId, credits }
 */

import { NextRequest, NextResponse } from "next/server";
import { getMyPrinterCredits, setStudentPrinterCredits } from "@/actions/printing";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function GET(req: NextRequest) {
	try {
		// Validar sesión
		const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
		if (!session.userId) {
			return NextResponse.json({ error: "No autenticado" }, { status: 401 });
		}

		const credits = await getMyPrinterCredits();
		return NextResponse.json(credits);
	} catch (error) {
		console.error("[GET /api/printer/credits]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error al obtener créditos" },
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
		const { userId, credits } = body;

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
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error al asignar créditos" },
			{ status: 500 }
		);
	}
}
