/**
 * GET /api/shop/products/admin
 * Lista TODOS los productos (activos e inactivos) para gestión del admin.
 * Acceso: solo admin (validado en la Server Action).
 */

import { NextResponse } from "next/server";
import { listAllProducts } from "@/actions/shop";

export async function GET() {
	try {
		const products = await listAllProducts();
		return NextResponse.json(products);
	} catch (error) {
		console.error("[GET /api/shop/products/admin]", error);
		const message = error instanceof Error ? error.message : "Error al listar productos";
		const status = message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
