/**
 * GET /api/shop/categories
 * Lista las categorías únicas de productos activos.
 * Acceso: usuarios autenticados (validado en la Server Action).
 */

import { NextResponse } from "next/server";
import { getProductCategories } from "@/actions/shop";

export async function GET() {
	try {
		const categories = await getProductCategories();
		return NextResponse.json(categories);
	} catch (error) {
		console.error("[GET /api/shop/categories]", error);
		const message = error instanceof Error ? error.message : "Error al obtener categorías";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
