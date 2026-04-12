import { NextRequest, NextResponse } from "next/server";
import { expireReservation } from "@/actions/library";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id } = await params;
		const result = await expireReservation(id);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al expirar reserva";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/library/loans/[id]/expire]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
