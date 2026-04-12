import { NextResponse } from "next/server";
import { getLibraryBalance } from "@/actions/library";

export async function GET() {
	try {
		const balance = await getLibraryBalance();
		return NextResponse.json({ balance });
	} catch (error) {
		console.error("[GET /api/library/balance]", error);
		const message = error instanceof Error ? error.message : "Error al obtener balance";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
