/**
 * GET /api/shop/orders
 * Lista los pedidos del usuario logueado con paginación.
 * Query params: ?limit=20&offset=0
 * Acceso: estudiantes y profesores (validado en la Server Action).
 */

import { NextRequest, NextResponse } from "next/server";
import { listMyOrders } from "@/actions/shop";

export async function GET(req: NextRequest) {
	try {
		const params = req.nextUrl.searchParams;
		const limit = parseInt(params.get("limit") || "20", 10);
		const offset = parseInt(params.get("offset") || "0", 10);

		const result = await listMyOrders(limit, offset);
		return NextResponse.json(result);
	} catch (error) {
		console.error("[GET /api/shop/orders]", error);
		const message = error instanceof Error ? error.message : "Error al listar pedidos";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
