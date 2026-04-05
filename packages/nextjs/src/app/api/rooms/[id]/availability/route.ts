import { NextRequest, NextResponse } from "next/server";
import { getRoomAvailability } from "@/actions/rooms";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const date = req.nextUrl.searchParams.get("date");

		if (!date) {
			return NextResponse.json({ error: "Parámetro requerido: date" }, { status: 400 });
		}

		const availability = await getRoomAvailability(id, date);
		return NextResponse.json({ availability });
	} catch (error) {
		console.error("[GET /api/rooms/[id]/availability]", error);
		const message = error instanceof Error ? error.message : "Error al obtener disponibilidad";
		const status = message.includes("no encontrada") ? 404
			: message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
