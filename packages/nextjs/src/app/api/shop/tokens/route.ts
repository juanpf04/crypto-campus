/**
 * POST /api/shop/tokens
 * Mintea ShopTokens a un usuario.
 * Body: { userId, amount }
 * Acceso: solo admin (validado en la Server Action).
 */

import { NextRequest, NextResponse } from "next/server";
import { mintShopTokens } from "@/actions/shop";

export async function POST(req: NextRequest) {
	try {
		const { userId, amount } = await req.json();

		if (!userId || amount === undefined) {
			return NextResponse.json(
				{ error: "Campos requeridos: userId, amount" },
				{ status: 400 },
			);
		}

		const result = await mintShopTokens(userId, amount);
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		console.error("[POST /api/shop/tokens]", error);
		const message = error instanceof Error ? error.message : "Error al mintear tokens";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403
			: message === "Usuario no encontrado" ? 404 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
