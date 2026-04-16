/**
 * GET /api/badges/my
 * Resumen de insignias del estudiante autenticado.
 * Retorna: { earnedBadges, availableAssignments, pendingRedemptions, recentAwards }
 */

import { NextResponse } from "next/server";
import { getMyBadgeSummary } from "@/actions/badges";

export async function GET() {
	try {
		const summary = await getMyBadgeSummary();
		return NextResponse.json(summary);
	} catch (error) {
		console.error("[GET /api/badges/my]", error);
		const message = error instanceof Error ? error.message : "Error al obtener resumen de insignias";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
