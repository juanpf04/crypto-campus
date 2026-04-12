import { NextRequest, NextResponse } from "next/server";
import { getStudentsForSubject } from "@/actions/badges";

type Params = { params: Promise<{ subjectOfferingId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
	try {
		const { subjectOfferingId } = await params;
		const result = await getStudentsForSubject(subjectOfferingId);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al obtener estudiantes";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/badges/students/[subjectOfferingId]]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
