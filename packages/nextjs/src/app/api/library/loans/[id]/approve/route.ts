import { NextRequest, NextResponse } from "next/server";
import { approveLoan } from "@/actions/library";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await approveLoan(id);
		return NextResponse.json(result);
	} catch (error) {
		console.error("[POST /api/library/loans/[id]/approve]", error);
		const message = error instanceof Error ? error.message : "Error al aprobar préstamo";
		const status = message.includes("no encontrado") ? 404
			: message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
