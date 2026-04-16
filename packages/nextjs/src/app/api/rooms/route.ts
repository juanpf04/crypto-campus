import { NextRequest, NextResponse } from "next/server";
import { listRooms, addRoom } from "@/actions/rooms";

export async function GET(req: NextRequest) {
	try {
		const activeOnly = req.nextUrl.searchParams.get("activeOnly") !== "false";
		const limit = req.nextUrl.searchParams.get("limit");
		const offset = req.nextUrl.searchParams.get("offset");
		const rooms = await listRooms(
			activeOnly,
			limit ? parseInt(limit) : undefined,
			offset ? parseInt(offset) : undefined,
		);
		return NextResponse.json(rooms);
	} catch (error) {
		console.error("[GET /api/rooms]", error);
		const message = error instanceof Error ? error.message : "Error al listar salas";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { name, description, location, capacity, amenities } = body;

		if (!name || !capacity) {
			return NextResponse.json(
				{ error: "Campos requeridos: name, capacity" },
				{ status: 400 },
			);
		}

		const result = await addRoom({ name, description, location, capacity, amenities });
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		console.error("[POST /api/rooms]", error);
		const message = error instanceof Error ? error.message : "Error al crear sala";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
