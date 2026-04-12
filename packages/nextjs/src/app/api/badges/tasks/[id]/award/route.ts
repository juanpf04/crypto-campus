import { NextRequest, NextResponse } from "next/server";
import { awardBadge } from "@/actions/badges";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const body = await req.json();
		const result = await awardBadge(id, body.studentId);
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al otorgar badge";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/badges/tasks/[id]/award]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
