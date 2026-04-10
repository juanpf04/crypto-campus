import { NextRequest, NextResponse } from "next/server";
import { listLoans, requestLoan } from "@/actions/library";

export async function GET(req: NextRequest) {
	try {
		const status = req.nextUrl.searchParams.get("status") as "QUEUED" | "RESERVED" | "PICKED_UP" | "RETURNED" | "CANCELLED" | null;
		const itemId = req.nextUrl.searchParams.get("itemId") || undefined;

		const limit = req.nextUrl.searchParams.get("limit");
		const offset = req.nextUrl.searchParams.get("offset");

		const loans = await listLoans({
			status: status || undefined,
			itemId,
			limit: limit ? parseInt(limit) : undefined,
			offset: offset ? parseInt(offset) : undefined,
		});
		return NextResponse.json(loans);
	} catch (error) {
		console.error("[GET /api/library/loans]", error);
		const message = error instanceof Error ? error.message : "Error al listar préstamos";
		const status = message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { itemId } = body;

		if (!itemId) {
			return NextResponse.json({ error: "Campo requerido: itemId" }, { status: 400 });
		}

		const result = await requestLoan(itemId);
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al solicitar préstamo";
		const isValidation = message.includes("Ya tienes") || message.includes("no encontrado") || message.includes("inactivo");
		const status = message === "No autorizado" ? 403 : isValidation ? 400 : 500;
		if (status === 500) console.error("[POST /api/library/loans]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
