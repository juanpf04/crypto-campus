import { NextRequest, NextResponse } from "next/server";
import { listAllTransactions } from "@/actions/shop";

/**
 * GET /api/shop/transactions — Log unificado de compras + recargas + devoluciones (admin).
 * Query params: limit, offset, userId, type (purchase|topup|refund), direction (income|expense)
 */
export async function GET(req: NextRequest) {
	const { searchParams } = req.nextUrl;
	const limit = Number(searchParams.get("limit") ?? 10);
	const offset = Number(searchParams.get("offset") ?? 0);
	const userId = searchParams.get("userId") ?? undefined;
	const typeFilter = searchParams.get("type") as "purchase" | "topup" | "refund" | undefined;
	const directionFilter = searchParams.get("direction") as "income" | "expense" | undefined;

	try {
		const result = await listAllTransactions(limit, offset, userId, typeFilter || undefined, directionFilter || undefined);
		return NextResponse.json(result);
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error al obtener transacciones" },
			{ status: error instanceof Error && error.message.includes("permiso") ? 403 : 500 },
		);
	}
}
