/**
 * GET /api/shop/balance/[userId]
 * Obtiene el balance de ShopTokens de un usuario específico.
 * Acceso: solo admin (validado en la Server Action).
 */

import { NextRequest, NextResponse } from "next/server";
import { getStudentShopBalance } from "@/actions/shop";

type Params = { params: Promise<{ userId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
	try {
		const { userId } = await params;
		const result = await getStudentShopBalance(userId);
		return NextResponse.json(result);
	} catch (error) {
		console.error("[GET /api/shop/balance/[userId]]", error);
		const message = error instanceof Error ? error.message : "Error al obtener balance";
		const status = message === "No autorizado" ? 403
			: message === "Usuario no encontrado" ? 404 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
