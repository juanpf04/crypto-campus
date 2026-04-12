/**
 * POST /api/shop/products/groups/[groupKey]/variants — Añadir variante a un grupo.
 */

import { NextRequest, NextResponse } from "next/server";
import { addVariantToGroup } from "@/actions/shop";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupKey: string }> },
) {
  try {
    const { groupKey } = await params;
    const body = await req.json();
    const result = await addVariantToGroup(groupKey, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    if (msg === "No autenticado" || msg === "No autorizado") return NextResponse.json({ error: msg }, { status: 403 });
    if (msg.includes("no encontrado")) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
