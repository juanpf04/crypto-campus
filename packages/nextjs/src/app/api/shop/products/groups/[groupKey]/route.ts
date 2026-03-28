/**
 * GET /api/shop/products/groups/[groupKey] — Detalle de un grupo de producto.
 * PUT /api/shop/products/groups/[groupKey] — Actualizar campos compartidos del grupo.
 * PATCH /api/shop/products/groups/[groupKey] — Toggle activo/inactivo del grupo entero.
 */

import { NextRequest, NextResponse } from "next/server";
import { getProductGroup, updateProductGroup, toggleGroupActive } from "@/actions/shop";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ groupKey: string }> },
) {
  try {
    const { groupKey } = await params;
    const group = await getProductGroup(groupKey);
    return NextResponse.json(group);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    if (msg === "No autorizado") return NextResponse.json({ error: msg }, { status: 403 });
    if (msg.includes("no encontrado")) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ groupKey: string }> },
) {
  try {
    const { groupKey } = await params;
    const body = await req.json();
    const result = await updateProductGroup(groupKey, body);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    if (msg === "No autorizado") return NextResponse.json({ error: msg }, { status: 403 });
    if (msg.includes("no encontrado")) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupKey: string }> },
) {
  try {
    const { groupKey } = await params;
    const { active } = await req.json();
    if (typeof active !== "boolean") {
      return NextResponse.json({ error: "active debe ser boolean" }, { status: 400 });
    }
    const result = await toggleGroupActive(groupKey, active);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    if (msg === "No autorizado") return NextResponse.json({ error: msg }, { status: 403 });
    if (msg.includes("no encontrado")) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
