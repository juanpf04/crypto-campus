import { NextRequest, NextResponse } from "next/server";
import { listAssignmentsForProfessor, createAssignment } from "@/actions/badges";

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const subject = searchParams.get("subject") ?? undefined;
		const professor = searchParams.get("professor") ?? undefined;
		const result = await listAssignmentsForProfessor({
			subjectOfferingId: subject,
			professorId: professor,
		});
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al listar tareas";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/badges/assignments]", error);
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const result = await createAssignment(body);
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al crear tarea";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/badges/assignments]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
