import { NextResponse } from "next/server";
import { getMyLoans } from "@/actions/library";

export async function GET() {
	try {
		const loans = await getMyLoans();
		return NextResponse.json(loans);
	} catch (error) {
		console.error("[GET /api/library/loans/my]", error);
		const message = error instanceof Error ? error.message : "Error al obtener préstamos";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
