import { NextRequest, NextResponse } from "next/server";
import { getMyRewardsWithState } from "@/actions/badges";

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const subjectOfferingId = searchParams.get("subject") ?? undefined;

		const result = await getMyRewardsWithState(subjectOfferingId);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al obtener mis recompensas";
		const status = message === "No autenticado"
			? 401
			: message === "No autorizado" || message.includes("No estás matriculado")
			? 403
			: 500;
		if (status === 500) console.error("[GET /api/badges/my/rewards]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
