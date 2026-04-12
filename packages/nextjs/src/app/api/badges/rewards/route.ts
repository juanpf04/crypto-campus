import { NextRequest, NextResponse } from "next/server";
import { listRewards, createReward } from "@/actions/badges";

export async function GET(req: NextRequest) {
	try {
		const badgeTypeId = req.nextUrl.searchParams.get("badgeTypeId") || undefined;
		const result = await listRewards(badgeTypeId);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al listar recompensas";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/badges/rewards]", error);
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const result = await createReward(body);
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al crear recompensa";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/badges/rewards]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
