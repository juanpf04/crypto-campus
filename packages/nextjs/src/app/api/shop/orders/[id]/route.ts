/**
 * GET /api/shop/orders/[id]
 * Obtiene el detalle de un pedido individual.
 * Acceso: el dueño del pedido o admin (validado en la Server Action).
 */

import { NextRequest, NextResponse } from "next/server";
import { getOrderDetail } from "@/actions/shop";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const order = await getOrderDetail(id);
		return NextResponse.json(order);
	} catch (error) {
		console.error("[GET /api/shop/orders/[id]]", error);
		const message = error instanceof Error ? error.message : "Error al obtener pedido";
		const status = message === "Pedido no encontrado" ? 404
			: message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
