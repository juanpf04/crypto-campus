import { NextRequest, NextResponse } from "next/server";
import { getLibraryBalance } from "@/actions/library";

type Params = { params: Promise<{ userId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
	try {
		const { userId } = await params;
		const balance = await getLibraryBalance(userId);
		return NextResponse.json({ balance });
	} catch (error) {
		console.error("[GET /api/library/balance/[userId]]", error);
		const message = error instanceof Error ? error.message : "Error al obtener balance";
		const status = message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
