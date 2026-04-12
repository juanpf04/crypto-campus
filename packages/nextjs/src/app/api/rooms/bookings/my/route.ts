import { NextResponse } from "next/server";
import { getMyBookings } from "@/actions/rooms";

export async function GET() {
	try {
		const bookings = await getMyBookings();
		return NextResponse.json(bookings);
	} catch (error) {
		console.error("[GET /api/rooms/bookings/my]", error);
		const message = error instanceof Error ? error.message : "Error al obtener reservas";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
