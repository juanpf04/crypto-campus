import { NextRequest, NextResponse } from "next/server";
import { getOffering, updateOffering, deleteOffering } from "@/actions/academic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const offering = await getOffering(id);
		return NextResponse.json(offering);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al obtener oferta";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/academic/offerings/[id]]", error);
		return NextResponse.json({ error: message }, { status });
	}
}

export async function PUT(req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const body = await req.json();
		const result = await updateOffering(id, body);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al actualizar oferta";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[PUT /api/academic/offerings/[id]]", error);
		return NextResponse.json({ error: message }, { status });
	}
}

export async function DELETE(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await deleteOffering(id);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al eliminar oferta";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[DELETE /api/academic/offerings/[id]]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
