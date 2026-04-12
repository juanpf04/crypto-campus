/**
 * GET /api/shop/products
 * Lista productos activos del catálogo.
 * Query params: ?category=Ropa (opcional)
 * Acceso: usuarios autenticados (validado en la Server Action).
 *
 * POST /api/shop/products
 * Crea un nuevo producto (on-chain + Prisma).
 * Body: { name, description?, price, stock, category?, imageUrl? }
 * Acceso: solo admin (validado en la Server Action).
 */

import { NextRequest, NextResponse } from "next/server";
import { listGroupedProducts, addProduct } from "@/actions/shop";

export async function GET(req: NextRequest) {
	try {
		const category = req.nextUrl.searchParams.get("category") || undefined;
		const products = await listGroupedProducts(category);
		return NextResponse.json(products);
	} catch (error) {
		console.error("[GET /api/shop/products]", error);
		const message = error instanceof Error ? error.message : "Error al listar productos";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { name, description, price, stock, category, imageUrl } = body;

		if (!name || price === undefined || stock === undefined) {
			return NextResponse.json(
				{ error: "Campos requeridos: name, price, stock" },
				{ status: 400 },
			);
		}

		const product = await addProduct({ name, description, price, stock, category, imageUrl });
		return NextResponse.json(product, { status: 201 });
	} catch (error) {
		console.error("[POST /api/shop/products]", error);
		const message = error instanceof Error ? error.message : "Error al crear producto";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
