import { NextRequest, NextResponse } from "next/server";
import { listAwardsForTask } from "@/actions/badges";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await listAwardsForTask(id);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al listar otorgamientos";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/badges/tasks/[id]/awards]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
