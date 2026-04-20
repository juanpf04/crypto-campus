import { NextResponse } from "next/server";
import { getSubjectBadgesBreakdown } from "@/actions/badges";

export async function GET(
	_req: Request,
	context: { params: Promise<{ offeringId: string }> },
) {
	const { offeringId } = await context.params;
	try {
		const result = await getSubjectBadgesBreakdown(offeringId);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al obtener desglose de insignias";
		const status = message === "No autenticado"
			? 401
			: message === "No autorizado" || message.includes("No estás matriculado")
			? 403
			: message.includes("no encontrada")
			? 404
			: 500;
		if (status === 500) console.error("[GET /api/badges/my/subjects/[offeringId]/breakdown]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
