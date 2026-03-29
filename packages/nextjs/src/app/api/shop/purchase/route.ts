/**
 * POST /api/shop/purchase
 * Compra rápida: crea un ticket (batch) directamente sin pasar por el carrito.
 * Body: { productId, quantity? } (ID de Prisma del producto, cantidad por defecto 1)
 * Acceso: estudiantes y profesores.
 */

import { NextRequest, NextResponse } from "next/server";
import { quickPurchase } from "@/actions/shop";

export async function POST(req: NextRequest) {
	try {
		const { productId, quantity } = await req.json();

		if (!productId) {
			return NextResponse.json(
				{ error: "Campo requerido: productId" },
				{ status: 400 },
			);
		}

		const result = await quickPurchase(productId, quantity ?? 1);
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al realizar la compra";
		const status = message === "No autorizado" ? 403
			: message === "Producto no encontrado" ? 404
			: message === "Producto no disponible" || message.startsWith("Stock insuficiente") ? 409
			: message.startsWith("Saldo insuficiente") ? 402
			: 500;
		return NextResponse.json({ error: message }, { status });
	}
}
