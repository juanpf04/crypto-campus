import { NextResponse } from "next/server";
import { listStudentsForAdmin } from "@/actions/academic";

export async function GET() {
	try {
		const students = await listStudentsForAdmin();
		return NextResponse.json(students);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al listar estudiantes";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/academic/students]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
