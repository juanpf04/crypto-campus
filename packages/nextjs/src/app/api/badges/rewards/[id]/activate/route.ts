import { NextRequest, NextResponse } from "next/server";
import { activateReward } from "@/actions/badges";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await activateReward(id);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al reactivar recompensa";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/badges/rewards/[id]/activate]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
