import { NextRequest, NextResponse } from "next/server";
import { enrollStudent } from "@/actions/academic";

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { userId, subjectOfferingId } = body;

		if (!userId || !subjectOfferingId) {
			return NextResponse.json(
				{ error: "Campos requeridos: userId, subjectOfferingId" },
				{ status: 400 },
			);
		}

		const result = await enrollStudent({ userId, subjectOfferingId });
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al matricular alumno";
		const status = message === "No autenticado"
			? 401
			: message === "No autorizado"
				? 403
				: message.includes("ya está matriculado")
					? 409
					: 500;
		if (status === 500) console.error("[POST /api/academic/enrollments]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
