import { NextRequest, NextResponse } from "next/server";
import { getAssignment } from "@/actions/badges";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await getAssignment(id);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al obtener tarea";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/badges/assignments/[id]]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
