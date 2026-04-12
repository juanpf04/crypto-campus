import { NextRequest, NextResponse } from "next/server";
import { listStudentTokenBalances, mintLibraryTokens } from "@/actions/library";

export async function GET() {
	try {
		const students = await listStudentTokenBalances();
		return NextResponse.json(students);
	} catch (error) {
		console.error("[GET /api/library/tokens]", error);
		const message = error instanceof Error ? error.message : "Error";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { userId, amount } = body;

		if (!userId || amount === undefined) {
			return NextResponse.json({ error: "Campos requeridos: userId, amount" }, { status: 400 });
		}

		const result = await mintLibraryTokens(userId, amount);
		return NextResponse.json(result);
	} catch (error) {
		console.error("[POST /api/library/tokens]", error);
		const message = error instanceof Error ? error.message : "Error";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
