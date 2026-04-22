/**
 * API de gestión individual de usuarios (admin).
 *
 * GET   /api/admin/users/[id] — Datos editables del usuario (nombre, email, rol, active).
 * PATCH /api/admin/users/[id] — Actualiza nombre y/o contraseña. Email y rol NO son editables.
 *
 * Ambos endpoints requieren sesión activa con role ADMIN.
 */

import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") return null;
  return session;
}

// ─── GET: Leer usuario ──────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

// ─── PATCH: Editar nombre y/o contraseña ────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const password = typeof body.password === "string" && body.password.length > 0
    ? body.password
    : undefined;

  // Por diseño: email y rol son inmutables desde este endpoint.
  // Email está bindeado a la wallet (único); rol implica revoke/grant on-chain.

  if (!name && !password) {
    return NextResponse.json(
      { error: "Nada que actualizar: envía nombre y/o contraseña" },
      { status: 400 },
    );
  }

  if (name !== undefined && name.length === 0) {
    return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const data: { name?: string; password?: string } = {};
  if (name) data.name = name;
  if (password) data.password = await hash(password, 10);

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  return NextResponse.json({ user: updated });
}
