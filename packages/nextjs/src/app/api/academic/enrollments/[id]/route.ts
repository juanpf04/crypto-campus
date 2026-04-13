import { NextRequest, NextResponse } from "next/server";
import { unenrollStudent } from "@/actions/academic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await unenrollStudent(id);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al desmatricular alumno";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[DELETE /api/academic/enrollments/[id]]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
