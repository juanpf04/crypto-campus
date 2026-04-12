import { NextRequest, NextResponse } from "next/server";
import { deactivateReward } from "@/actions/badges";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await deactivateReward(id);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al desactivar recompensa";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/badges/rewards/[id]/deactivate]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
