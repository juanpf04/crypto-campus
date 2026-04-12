import { NextRequest, NextResponse } from "next/server";
import { listBadgeTypes, createBadgeType } from "@/actions/badges";

export async function GET() {
	try {
		const result = await listBadgeTypes();
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al listar tipos de badge";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/badges/types]", error);
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const result = await createBadgeType(body);
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al crear tipo de badge";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/badges/types]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
