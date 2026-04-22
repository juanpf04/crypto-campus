/**
 * POST /api/admin/users/[id]/status — Activa/desactiva un usuario (soft-delete).
 *
 * Body: { active: boolean }
 * - active=false → desactiva: el usuario no podrá iniciar sesión y las sesiones
 *   abiertas se invalidan en el siguiente /api/auth/me.
 * - active=true  → reactiva: el usuario recupera acceso al login.
 *
 * El admin NO puede desactivarse a sí mismo.
 *
 * No toca el estado on-chain (rol en CampusRoles): el gate vive sólo en la sesión,
 * que es lo único que necesita el sistema custodial para bloquear operaciones.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") return null;
  return session;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  if (typeof body.active !== "boolean") {
    return NextResponse.json(
      { error: "Campo requerido: active (boolean)" },
      { status: 400 },
    );
  }

  if (body.active === false && id === session.userId) {
    return NextResponse.json(
      { error: "No puedes desactivar tu propia cuenta" },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, active: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (existing.active === body.active) {
    return NextResponse.json(
      { user: { id: existing.id, active: existing.active } },
    );
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { active: body.active },
    select: { id: true, name: true, email: true, active: true },
  });

  return NextResponse.json({ user: updated });
}
