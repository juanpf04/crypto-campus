/**
 * PUT /api/shop/orders/[id]/return
 * Procesa o solicita la devolución de un pedido.
 * - Si el caller es ADMIN: processReturn (sin límite de tiempo).
 * - Si el caller es STUDENT/PROFESSOR: requestReturn (30 días desde entrega).
 * Acceso: admin o dueño del pedido (validado en las Server Actions).
 */

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";
import { processReturn, requestReturn } from "@/actions/shop";

type Params = { params: Promise<{ id: string }> };

export async function PUT(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;

		// Determinar qué acción ejecutar según el rol del caller
		const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

		let order;
		if (session.role === "ADMIN") {
			order = await processReturn(id);
		} else {
			order = await requestReturn(id);
		}

		return NextResponse.json(order);
	} catch (error) {
		console.error("[PUT /api/shop/orders/[id]/return]", error);
		const message = error instanceof Error ? error.message : "Error al procesar devolución";
		const status = message === "Pedido no encontrado" ? 404
			: message === "No autorizado" ? 403
			: message === "El pedido ya fue devuelto" || message.startsWith("Solo se pueden") || message === "El plazo de devolución de 30 días ha expirado" ? 409
			: 500;
		return NextResponse.json({ error: message }, { status });
	}
}
