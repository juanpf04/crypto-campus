import { NextResponse } from "next/server";
import { getLibraryStats } from "@/actions/library";

export async function GET() {
	try {
		const stats = await getLibraryStats();
		return NextResponse.json(stats);
	} catch (error) {
		console.error("[GET /api/library/stats]", error);
		const message = error instanceof Error ? error.message : "Error al obtener estadísticas";
		const status = message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
