import { NextRequest, NextResponse } from "next/server";
import { cancelBooking } from "@/actions/rooms";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await cancelBooking(id);
		return NextResponse.json(result);
	} catch (error) {
		console.error("[POST /api/rooms/bookings/[id]/cancel]", error);
		const message = error instanceof Error ? error.message : "Error al cancelar reserva";
		const status = message.includes("no encontrada") ? 404
			: message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
