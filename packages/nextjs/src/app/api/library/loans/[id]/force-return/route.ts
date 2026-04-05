import { NextRequest, NextResponse } from "next/server";
import { forceReturn } from "@/actions/library";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await forceReturn(id);
		return NextResponse.json(result);
	} catch (error) {
		console.error("[POST /api/library/loans/[id]/force-return]", error);
		const message = error instanceof Error ? error.message : "Error al forzar devolución";
		const status = message.includes("no encontrado") ? 404
			: message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
