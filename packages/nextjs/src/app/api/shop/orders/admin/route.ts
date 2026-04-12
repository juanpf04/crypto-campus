/**
 * GET /api/shop/orders/admin
 * Lista todos los pedidos del sistema con paginación y filtros.
 * Query params: ?limit=50&offset=0&userId=xxx&status=PAID
 * Acceso: solo admin (validado en la Server Action).
 */

import { NextRequest, NextResponse } from "next/server";
import { listAllOrders } from "@/actions/shop";

export async function GET(req: NextRequest) {
	try {
		const params = req.nextUrl.searchParams;
		const limit = parseInt(params.get("limit") || "50", 10);
		const offset = parseInt(params.get("offset") || "0", 10);
		const userId = params.get("userId") || undefined;
		const status = params.get("status") || undefined;

		const result = await listAllOrders(limit, offset, userId, status);
		return NextResponse.json(result);
	} catch (error) {
		console.error("[GET /api/shop/orders/admin]", error);
		const message = error instanceof Error ? error.message : "Error al listar pedidos";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
