import { NextRequest, NextResponse } from "next/server";
import { getOffering, enrollStudent } from "@/actions/academic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const offering = await getOffering(id);
		return NextResponse.json(offering.enrollments ?? []);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al obtener matrículas";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/academic/offerings/[id]/enrollments]", error);
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const body = await req.json();
		const result = await enrollStudent({ userId: body.userId, subjectOfferingId: id });
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al matricular alumno";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/academic/offerings/[id]/enrollments]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
