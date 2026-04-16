import { NextRequest, NextResponse } from "next/server";
import { closeAssignment } from "@/actions/badges";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await closeAssignment(id);
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al cerrar tarea";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/badges/assignments/[id]/close]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
