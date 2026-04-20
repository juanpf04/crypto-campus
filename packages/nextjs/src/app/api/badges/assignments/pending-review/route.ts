import { NextResponse } from "next/server";
import { getAssignmentsPendingReview } from "@/actions/badges";

export async function GET() {
	try {
		const result = await getAssignmentsPendingReview();
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al obtener tareas pendientes de revisión";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/badges/assignments/pending-review]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
