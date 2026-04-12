import { NextRequest, NextResponse } from "next/server";
import { listItems, addItem } from "@/actions/library";

export async function GET(req: NextRequest) {
	try {
		const type = req.nextUrl.searchParams.get("type") as "BOOK" | "BOARD_GAME" | "VIDEO_GAME" | "OTHER" | null;
		const category = req.nextUrl.searchParams.get("category") || undefined;
		const search = req.nextUrl.searchParams.get("search") || undefined;
		const activeOnly = req.nextUrl.searchParams.get("activeOnly") !== "false";

		const limit = req.nextUrl.searchParams.get("limit");
		const offset = req.nextUrl.searchParams.get("offset");

		const items = await listItems({
			type: type || undefined,
			category,
			search,
			activeOnly,
			limit: limit ? parseInt(limit) : undefined,
			offset: offset ? parseInt(offset) : undefined,
		});
		return NextResponse.json(items);
	} catch (error) {
		console.error("[GET /api/library/items]", error);
		const message = error instanceof Error ? error.message : "Error al listar ítems";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { title, type, creator, description, coverUrl, category, physicalLocation, physicalCondition, copies, metadata } = body;

		if (!title || !copies) {
			return NextResponse.json(
				{ error: "Campos requeridos: title, copies" },
				{ status: 400 },
			);
		}

		const result = await addItem({
			title, type: type || "BOOK", creator, description, coverUrl,
			category, physicalLocation, physicalCondition, copies, metadata,
		});
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		console.error("[POST /api/library/items]", error);
		const message = error instanceof Error ? error.message : "Error al crear ítem";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
