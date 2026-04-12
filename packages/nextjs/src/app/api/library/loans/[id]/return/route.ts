import { NextRequest, NextResponse } from "next/server";
import { confirmReturn } from "@/actions/library";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await confirmReturn(id);
		return NextResponse.json(result);
	} catch (error) {
		console.error("[POST /api/library/loans/[id]/return]", error);
		const message = error instanceof Error ? error.message : "Error al confirmar devolución";
		const status = message.includes("no encontrado") ? 404
			: message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
