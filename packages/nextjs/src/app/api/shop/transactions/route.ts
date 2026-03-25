import { NextRequest, NextResponse } from "next/server";
import { listAllTransactions } from "@/actions/shop";

/**
 * GET /api/shop/transactions — Log unificado de compras + recargas (admin).
 * Query params: limit, offset, userId
 */
export async function GET(req: NextRequest) {
	const { searchParams } = req.nextUrl;
	const limit = Number(searchParams.get("limit") ?? 10);
	const offset = Number(searchParams.get("offset") ?? 0);
	const userId = searchParams.get("userId") ?? undefined;

	try {
		const result = await listAllTransactions(limit, offset, userId);
		return NextResponse.json(result);
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error al obtener transacciones" },
			{ status: error instanceof Error && error.message.includes("permiso") ? 403 : 500 },
		);
	}
}
