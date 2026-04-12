import { NextResponse } from "next/server";
import { getMyUseRequests } from "@/actions/badges";

export async function GET() {
	try {
		const result = await getMyUseRequests();
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al obtener solicitudes de uso";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/badges/my/requests]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
