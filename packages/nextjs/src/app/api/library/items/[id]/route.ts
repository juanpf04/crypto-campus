import { NextRequest, NextResponse } from "next/server";
import { getItem, updateItem, deactivateItem, reactivateItem } from "@/actions/library";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const item = await getItem(id);
		return NextResponse.json(item);
	} catch (error) {
		console.error("[GET /api/library/items/[id]]", error);
		const message = error instanceof Error ? error.message : "Error al obtener ítem";
		const status = message.includes("no encontrado") ? 404
			: message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function PUT(req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const body = await req.json();
		const result = await updateItem(id, body);
		return NextResponse.json(result);
	} catch (error) {
		console.error("[PUT /api/library/items/[id]]", error);
		const message = error instanceof Error ? error.message : "Error al actualizar ítem";
		const status = message.includes("no encontrado") ? 404
			: message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function DELETE(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await deactivateItem(id);
		return NextResponse.json(result);
	} catch (error) {
		console.error("[DELETE /api/library/items/[id]]", error);
		const message = error instanceof Error ? error.message : "Error al desactivar ítem";
		const status = message.includes("no encontrado") ? 404
			: message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function PATCH(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await reactivateItem(id);
		return NextResponse.json(result);
	} catch (error) {
		console.error("[PATCH /api/library/items/[id]]", error);
		const message = error instanceof Error ? error.message : "Error al reactivar ítem";
		const status = message.includes("no encontrado") ? 404
			: message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
