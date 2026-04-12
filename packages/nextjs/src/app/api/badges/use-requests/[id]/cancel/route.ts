import { NextRequest, NextResponse } from "next/server";
import { cancelUseRequest } from "@/actions/badges";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
	try {
		const { id } = await params;
		const result = await cancelUseRequest(Number(id));
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al cancelar solicitud de uso";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/badges/use-requests/[id]/cancel]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
