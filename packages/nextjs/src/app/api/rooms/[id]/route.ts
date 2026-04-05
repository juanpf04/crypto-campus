import { NextRequest, NextResponse } from "next/server";
import { getRoom, updateRoom, removeRoom } from "@/actions/rooms";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const room = await getRoom(id);
		return NextResponse.json(room);
	} catch (error) {
		console.error("[GET /api/rooms/[id]]", error);
		const message = error instanceof Error ? error.message : "Error al obtener sala";
		const status = message.includes("no encontrada") ? 404
			: message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function PUT(req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const body = await req.json();
		const result = await updateRoom(id, body);
		return NextResponse.json(result);
	} catch (error) {
		console.error("[PUT /api/rooms/[id]]", error);
		const message = error instanceof Error ? error.message : "Error al actualizar sala";
		const status = message.includes("no encontrada") ? 404
			: message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function DELETE(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await removeRoom(id);
		return NextResponse.json(result);
	} catch (error) {
		console.error("[DELETE /api/rooms/[id]]", error);
		const message = error instanceof Error ? error.message : "Error al eliminar sala";
		const status = message.includes("no encontrada") ? 404
			: message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
