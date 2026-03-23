/**
 * GET    /api/shop/products/[id] — Detalle de un producto.
 * PUT    /api/shop/products/[id] — Actualizar producto (admin).
 * DELETE /api/shop/products/[id] — Desactivar producto (admin).
 * PATCH  /api/shop/products/[id] — Reactivar producto (admin).
 */

import { NextRequest, NextResponse } from "next/server";
import { getProduct, updateProduct, deactivateProduct, reactivateProduct } from "@/actions/shop";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const product = await getProduct(id);
		return NextResponse.json(product);
	} catch (error) {
		console.error("[GET /api/shop/products/[id]]", error);
		const message = error instanceof Error ? error.message : "Error al obtener producto";
		const status = message === "Producto no encontrado" ? 404
			: message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function PUT(req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const body = await req.json();
		const { name, description, price, stock, category, imageUrl } = body;

		const product = await updateProduct(id, { name, description, price, stock, category, imageUrl });
		return NextResponse.json(product);
	} catch (error) {
		console.error("[PUT /api/shop/products/[id]]", error);
		const message = error instanceof Error ? error.message : "Error al actualizar producto";
		const status = message === "Producto no encontrado" ? 404
			: message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function DELETE(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const product = await deactivateProduct(id);
		return NextResponse.json(product);
	} catch (error) {
		console.error("[DELETE /api/shop/products/[id]]", error);
		const message = error instanceof Error ? error.message : "Error al desactivar producto";
		const status = message === "Producto no encontrado" ? 404
			: message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function PATCH(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const product = await reactivateProduct(id);
		return NextResponse.json(product);
	} catch (error) {
		console.error("[PATCH /api/shop/products/[id]]", error);
		const message = error instanceof Error ? error.message : "Error al reactivar producto";
		const status = message === "Producto no encontrado" ? 404
			: message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
