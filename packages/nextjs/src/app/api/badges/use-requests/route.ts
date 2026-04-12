import { NextRequest, NextResponse } from "next/server";
import { requestUseReward } from "@/actions/badges";

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const result = await requestUseReward(body.rewardId);
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al solicitar uso de recompensa";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/badges/use-requests]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
