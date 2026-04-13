import { NextResponse } from "next/server";
import { listProfessors } from "@/actions/academic";

export async function GET() {
	try {
		const professors = await listProfessors();
		return NextResponse.json(professors);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al listar profesores";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/academic/professors]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
