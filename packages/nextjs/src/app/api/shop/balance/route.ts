/**
 * GET /api/shop/balance
 * Obtiene el balance de ShopTokens del usuario logueado.
 * Acceso: estudiantes y profesores (validado en la Server Action).
 */

import { NextResponse } from "next/server";
import { getMyShopBalance } from "@/actions/shop";

export async function GET() {
	try {
		const result = await getMyShopBalance();
		return NextResponse.json(result);
	} catch (error) {
		console.error("[GET /api/shop/balance]", error);
		const message = error instanceof Error ? error.message : "Error al obtener balance";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
