/**
 * PUT /api/shop/orders/[id]/deliver
 * Marca un pedido como entregado (on-chain + Prisma).
 * Acceso: solo admin (validado en la Server Action).
 */

import { NextRequest, NextResponse } from "next/server";
import { markOrderDelivered } from "@/actions/shop";

type Params = { params: Promise<{ id: string }> };

export async function PUT(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const order = await markOrderDelivered(id);
		return NextResponse.json(order);
	} catch (error) {
		console.error("[PUT /api/shop/orders/[id]/deliver]", error);
		const message = error instanceof Error ? error.message : "Error al marcar como entregado";
		const status = message === "Pedido no encontrado" ? 404
			: message === "No autenticado" ? 401 : message === "No autorizado" ? 403
			: message.startsWith("Solo se pueden") ? 409 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
