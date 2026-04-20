import { NextResponse } from "next/server";
import { getStudentsInOffering } from "@/actions/badges";

export async function GET(
	_req: Request,
	context: { params: Promise<{ offeringId: string }> },
) {
	const { offeringId } = await context.params;
	try {
		const result = await getStudentsInOffering(offeringId);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al obtener alumnos";
		const status = message === "No autenticado"
			? 401
			: message === "No autorizado"
			? 403
			: message.includes("no encontrada")
			? 404
			: 500;
		if (status === 500) console.error("[GET /api/badges/offerings/[offeringId]/students]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
