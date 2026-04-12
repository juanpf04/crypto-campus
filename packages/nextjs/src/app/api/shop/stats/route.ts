/**
 * GET /api/shop/stats
 * Obtiene estadísticas generales de la tienda.
 * Acceso: solo admin (validado en la Server Action).
 */

import { NextResponse } from "next/server";
import { getShopStats } from "@/actions/shop";

export async function GET() {
	try {
		const stats = await getShopStats();
		return NextResponse.json(stats);
	} catch (error) {
		console.error("[GET /api/shop/stats]", error);
		const message = error instanceof Error ? error.message : "Error al obtener estadísticas";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
