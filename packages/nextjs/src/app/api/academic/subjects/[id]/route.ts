import { NextRequest, NextResponse } from "next/server";
import { getSubject, updateSubject, deleteSubject } from "@/actions/academic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const subject = await getSubject(id);
		return NextResponse.json(subject);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al obtener asignatura";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/academic/subjects/[id]]", error);
		return NextResponse.json({ error: message }, { status });
	}
}

export async function PUT(req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const body = await req.json();
		const result = await updateSubject(id, body);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al actualizar asignatura";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[PUT /api/academic/subjects/[id]]", error);
		return NextResponse.json({ error: message }, { status });
	}
}

export async function DELETE(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await deleteSubject(id);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al eliminar asignatura";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[DELETE /api/academic/subjects/[id]]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
