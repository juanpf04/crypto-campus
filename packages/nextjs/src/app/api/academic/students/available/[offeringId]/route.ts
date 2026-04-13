import { NextRequest, NextResponse } from "next/server";
import { listAvailableStudents } from "@/actions/academic";

type Params = { params: Promise<{ offeringId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
	try {
		const { offeringId } = await params;
		const students = await listAvailableStudents(offeringId);
		return NextResponse.json(students);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al listar estudiantes disponibles";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/academic/students/available/[offeringId]]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
