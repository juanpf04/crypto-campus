/**
 * GET /api/shop/batches — Mis pedidos agrupados (paginados).
 * Query params: limit, offset
 */

import { NextRequest, NextResponse } from "next/server";
import { listMyBatches } from "@/actions/shop";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const generalStatus = searchParams.get("generalStatus") ?? undefined;

    const result = await listMyBatches(limit, offset, generalStatus);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    if (msg === "No autenticado" || msg === "No autorizado") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
