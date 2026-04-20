import { NextResponse } from "next/server";
import { getMyEnrolledSubjects } from "@/actions/badges";

export async function GET() {
	try {
		const result = await getMyEnrolledSubjects();
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al listar asignaturas matriculadas";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/badges/my/subjects]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
