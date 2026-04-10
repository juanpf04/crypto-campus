import { NextRequest, NextResponse } from "next/server";
import { confirmPickup } from "@/actions/library";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id } = await params;
		const result = await confirmPickup(id);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al confirmar recogida";
		const status = message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/library/loans/[id]/pickup]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
