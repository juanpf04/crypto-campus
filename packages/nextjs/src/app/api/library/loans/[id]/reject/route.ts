import { NextRequest, NextResponse } from "next/server";
import { rejectLoan } from "@/actions/library";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const body = await req.json();
		const result = await rejectLoan(id, body.reason || "");
		return NextResponse.json(result);
	} catch (error) {
		console.error("[POST /api/library/loans/[id]/reject]", error);
		const message = error instanceof Error ? error.message : "Error al rechazar préstamo";
		const status = message.includes("no encontrado") ? 404
			: message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
