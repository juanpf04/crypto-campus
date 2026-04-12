import { NextRequest, NextResponse } from "next/server";
import { deactivateTask } from "@/actions/badges";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await deactivateTask(id);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al desactivar tarea";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/badges/tasks/[id]/deactivate]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
