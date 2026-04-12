import { NextResponse } from "next/server";
import { listAvailableRewards } from "@/actions/badges";

export async function GET() {
	try {
		const result = await listAvailableRewards();
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al listar recompensas disponibles";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/badges/rewards/available]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
