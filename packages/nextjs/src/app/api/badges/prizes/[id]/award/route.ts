import { NextRequest, NextResponse } from "next/server";
import { awardPrize } from "@/actions/badges";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const body = await req.json();
		if (!Array.isArray(body.studentIds)) {
			return NextResponse.json({ error: "studentIds debe ser un array" }, { status: 400 });
		}
		const result = await awardPrize(id, body.studentIds);
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al otorgar premio";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/badges/prizes/[id]/award]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
