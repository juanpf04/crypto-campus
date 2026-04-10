import { NextRequest, NextResponse } from "next/server";
import { cancelLoan } from "@/actions/library";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await cancelLoan(id);
		return NextResponse.json(result);
	} catch (error) {
		console.error("[POST /api/library/loans/[id]/cancel]", error);
		const message = error instanceof Error ? error.message : "Error al cancelar solicitud";
		const status = message.includes("no encontrado") ? 404
			: message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
