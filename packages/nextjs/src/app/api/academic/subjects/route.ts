import { NextRequest, NextResponse } from "next/server";
import { listSubjects, createSubject } from "@/actions/academic";

export async function GET() {
	try {
		const subjects = await listSubjects();
		return NextResponse.json(subjects);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al listar asignaturas";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/academic/subjects]", error);
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const result = await createSubject(body);
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al crear asignatura";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/academic/subjects]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
