/**
 * PUT /api/shop/products/variants/[id] — Actualizar una variante individual.
 * PATCH /api/shop/products/variants/[id] — Toggle activo/inactivo de una variante.
 */

import { NextRequest, NextResponse } from "next/server";
import { updateVariant, toggleVariantActive } from "@/actions/shop";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = await updateVariant(id, body);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    if (msg === "No autorizado") return NextResponse.json({ error: msg }, { status: 403 });
    if (msg.includes("no encontrad")) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { active } = await req.json();
    if (typeof active !== "boolean") {
      return NextResponse.json({ error: "active debe ser boolean" }, { status: 400 });
    }
    const result = await toggleVariantActive(id, active);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    if (msg === "No autorizado") return NextResponse.json({ error: msg }, { status: 403 });
    if (msg.includes("no encontrad")) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
