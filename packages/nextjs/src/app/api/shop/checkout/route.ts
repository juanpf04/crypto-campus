import { NextResponse } from "next/server";
import { checkoutCart } from "@/actions/shop";

/**
 * POST /api/shop/checkout
 * Procesa el pago y compra de todos los items en el carrito del usuario.
 */
export async function POST() {
	try {
		const result = await checkoutCart();
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error desconocido";

		// Mapear errores a códigos HTTP apropiados
		if (message.includes("vacío")) {
			return NextResponse.json({ error: message }, { status: 400 });
		}
		if (message.includes("no está disponible")) {
			return NextResponse.json({ error: message }, { status: 404 });
		}
		if (message.includes("Stock insuficiente")) {
			return NextResponse.json({ error: message }, { status: 409 });
		}
		if (message.includes("Saldo insuficiente")) {
			return NextResponse.json({ error: message }, { status: 402 });
		}
		if (message === "No autenticado" || message === "No autorizado") {
			return NextResponse.json({ error: message }, { status: 403 });
		}

		return NextResponse.json({ error: message }, { status: 500 });
	}
}
