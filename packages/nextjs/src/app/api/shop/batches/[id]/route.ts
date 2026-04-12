/**
 * GET /api/shop/batches/[id] — Detalle de un pedido agrupado.
 * PUT /api/shop/batches/[id] — Marcar todos los artículos como entregados (admin).
 */

import { NextRequest, NextResponse } from "next/server";
import { getBatchDetail, markBatchDelivered } from "@/actions/shop";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const batch = await getBatchDetail(id);
    return NextResponse.json(batch);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    if (msg === "No autenticado" || msg === "No autorizado") return NextResponse.json({ error: msg }, { status: 403 });
    if (msg.includes("no encontrado")) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await markBatchDelivered(id);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    if (msg === "No autenticado" || msg === "No autorizado") return NextResponse.json({ error: msg }, { status: 403 });
    if (msg.includes("no encontrado")) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
