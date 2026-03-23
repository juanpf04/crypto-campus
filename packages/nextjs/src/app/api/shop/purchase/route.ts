/**
 * POST /api/shop/purchase
 * Realiza una compra como el usuario logueado.
 * Body: { productId } (ID de Prisma del producto)
 * Acceso: estudiantes y profesores (validado en la Server Action).
 *
 * La transacción se firma con la wallet custodial del estudiante
 * para que el contrato verifique msg.sender correctamente.
 */

import { NextRequest, NextResponse } from "next/server";
import { purchaseProduct } from "@/actions/shop";

export async function POST(req: NextRequest) {
	try {
		const { productId } = await req.json();

		if (!productId) {
			return NextResponse.json(
				{ error: "Campo requerido: productId" },
				{ status: 400 },
			);
		}

		const result = await purchaseProduct(productId);
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		console.error("[POST /api/shop/purchase]", error);
		const message = error instanceof Error ? error.message : "Error al realizar la compra";
		const status = message === "No autorizado" ? 403
			: message === "Producto no encontrado" ? 404
			: message === "Producto no disponible" || message === "Producto sin stock" ? 409
			: message.startsWith("Saldo insuficiente") ? 402
			: 500;
		return NextResponse.json({ error: message }, { status });
	}
}
