import { NextResponse } from "next/server";
import { getRoomStats } from "@/actions/rooms";

export async function GET() {
	try {
		const stats = await getRoomStats();
		return NextResponse.json(stats);
	} catch (error) {
		console.error("[GET /api/rooms/stats]", error);
		const message = error instanceof Error ? error.message : "Error al obtener estadísticas";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
