/**
 * GET /api/professor/stats
 * Estadísticas del profesor autenticado para su dashboard.
 */
import { NextResponse } from "next/server";
import { getMyProfessorStats } from "@/actions/badges";

export async function GET() {
	try {
		const stats = await getMyProfessorStats();
		return NextResponse.json(stats);
	} catch (error) {
		console.error("[GET /api/professor/stats]", error);
		const message = error instanceof Error ? error.message : "Error al obtener estadísticas";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
