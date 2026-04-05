import { NextRequest, NextResponse } from "next/server";
import { listBookings, bookRoom } from "@/actions/rooms";

export async function GET(req: NextRequest) {
	try {
		const roomId = req.nextUrl.searchParams.get("roomId") || undefined;
		const date = req.nextUrl.searchParams.get("date") || undefined;
		const cancelled = req.nextUrl.searchParams.get("cancelled");

		const limit = req.nextUrl.searchParams.get("limit");
		const offset = req.nextUrl.searchParams.get("offset");

		const bookings = await listBookings({
			roomId,
			date,
			cancelled: cancelled !== null ? cancelled === "true" : undefined,
			limit: limit ? parseInt(limit) : undefined,
			offset: offset ? parseInt(offset) : undefined,
		});
		return NextResponse.json(bookings);
	} catch (error) {
		console.error("[GET /api/rooms/bookings]", error);
		const message = error instanceof Error ? error.message : "Error al listar reservas";
		const status = message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { roomId, date, startHour, duration } = body;

		if (!roomId || !date || startHour === undefined || !duration) {
			return NextResponse.json(
				{ error: "Campos requeridos: roomId, date, startHour, duration" },
				{ status: 400 },
			);
		}

		const result = await bookRoom(roomId, date, startHour, duration);
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		console.error("[POST /api/rooms/bookings]", error);
		const message = error instanceof Error ? error.message : "Error al reservar sala";
		const status = message === "No autorizado" ? 403
			: message.includes("inválida") ? 400
			: message.includes("ocupad") ? 409
			: message.includes("ya") ? 409 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
