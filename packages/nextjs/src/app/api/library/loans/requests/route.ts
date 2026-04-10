import { NextRequest, NextResponse } from "next/server";
import { listPendingPickups } from "@/actions/library";

export async function GET(req: NextRequest) {
	try {
		const limit = req.nextUrl.searchParams.get("limit");
		const offset = req.nextUrl.searchParams.get("offset");

		const requests = await listPendingPickups({
			limit: limit ? parseInt(limit) : undefined,
			offset: offset ? parseInt(offset) : undefined,
		});
		return NextResponse.json(requests);
	} catch (error) {
		console.error("[GET /api/library/loans/requests]", error);
		const message = error instanceof Error ? error.message : "Error al listar solicitudes";
		const status = message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
