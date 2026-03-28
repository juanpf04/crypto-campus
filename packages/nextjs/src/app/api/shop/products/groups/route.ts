/**
 * POST /api/shop/products/groups — Crear un nuevo producto (grupo + primera variante).
 */

import { NextRequest, NextResponse } from "next/server";
import { createProductGroup } from "@/actions/shop";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await createProductGroup(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    if (msg === "No autorizado") return NextResponse.json({ error: msg }, { status: 403 });
    if (msg.startsWith("Ya existe")) return NextResponse.json({ error: msg }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
