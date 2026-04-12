import { NextResponse } from "next/server";
import { getBadgeStats } from "@/actions/badges";

export async function GET() {
	try {
		const result = await getBadgeStats();
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al obtener estadísticas de badges";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/badges/stats]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
