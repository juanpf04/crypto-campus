/**
 * GET /api/shop/batches/admin — Todos los pedidos agrupados (admin).
 * Query params: limit, offset, userId (filtro opcional)
 */

import { NextRequest, NextResponse } from "next/server";
import { listAllBatches } from "@/actions/shop";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const userId = searchParams.get("userId") ?? undefined;
    const generalStatus = searchParams.get("generalStatus") ?? undefined;

    const result = await listAllBatches(limit, offset, userId, generalStatus);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    if (msg === "No autenticado" || msg === "No autorizado") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
