import { NextRequest, NextResponse } from "next/server";
import { getAssignmentsPendingReview } from "@/actions/badges";

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const subject = searchParams.get("subject") ?? undefined;
		const professor = searchParams.get("professor") ?? undefined;
		const result = await getAssignmentsPendingReview({
			subjectOfferingId: subject,
			professorId: professor,
		});
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al obtener tareas pendientes de revisión";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/badges/assignments/pending-review]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
