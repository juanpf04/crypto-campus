import { NextRequest, NextResponse } from "next/server";
import { listOfferings, createOffering } from "@/actions/academic";

export async function GET(req: NextRequest) {
	try {
		const subjectId = req.nextUrl.searchParams.get("subjectId") || undefined;
		const offerings = await listOfferings(subjectId);
		return NextResponse.json(offerings);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al listar ofertas";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[GET /api/academic/offerings]", error);
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const result = await createOffering(body);
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error al crear oferta";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		if (status === 500) console.error("[POST /api/academic/offerings]", error);
		return NextResponse.json({ error: message }, { status });
	}
}
