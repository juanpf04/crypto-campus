/**
 * API de gestión de usuarios para administradores.
 *
 * GET  /api/admin/users — Lista todos los usuarios (solo datos públicos).
 * POST /api/admin/users — Crea un usuario con cualquier rol.
 *
 * Ambos endpoints verifican que quien llama tiene sesión activa con role ADMIN.
 * El POST hace el mismo flujo que /api/auth/register pero:
 * - Acepta cualquier rol (PROFESSOR, LIBRARIAN, ADMIN)
 * - Solo mintea tokens LIB/SHOP si el rol es STUDENT
 * - No requiere dominio @ucm.es (el admin puede crear cualquier email)
 */

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { hash } from "bcryptjs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { parseEther } from "viem";
import { sessionOptions, SessionData } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { adminWalletClient, publicClient } from "@/lib/viem";
import {
  CONTRACT_ADDRESSES,
  CAMPUS_ACCESS_CONTROL_ABI,
  LIBRARY_TOKEN_ABI,
  SHOP_TOKEN_ABI,
  ROLES,
} from "@/lib/contracts";

/** Verificar que la sesión activa es de un ADMIN */
async function requireAdmin() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );
  if (!session.userId || session.role !== "ADMIN") {
    return null;
  }
  return session;
}

// ─── GET: Listar usuarios ───────────────────────────────────────────

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

// ─── POST: Crear usuario ────────────────────────────────────────────

/** Roles válidos y su hash on-chain */
const ROLE_MAP: Record<string, `0x${string}`> = {
  STUDENT: ROLES.STUDENT,
  PROFESSOR: ROLES.PROFESSOR,
  LIBRARIAN: ROLES.LIBRARIAN,
  ADMIN: ROLES.ADMIN,
};

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { name, email, password, role } = await req.json();

  // Validación
  if (!name || !email || !password || !role) {
    return NextResponse.json(
      { error: "Nombre, email, contraseña y rol son obligatorios" },
      { status: 400 },
    );
  }

  if (!ROLE_MAP[role]) {
    return NextResponse.json(
      { error: "Rol no válido" },
      { status: 400 },
    );
  }

  // Comprobar duplicados
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "El email ya está registrado" },
      { status: 409 },
    );
  }

  // Hashear contraseña
  const hashedPassword = await hash(password, 10);

  // Generar wallet
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const encryptedKey = encrypt(privateKey);

  // Fondear wallet con ETH (para gas)
  const fundHash = await adminWalletClient.sendTransaction({
    to: account.address,
    value: parseEther("10"),
  });
  await publicClient.waitForTransactionReceipt({ hash: fundHash });

  // Registrar on-chain con el rol correspondiente
  const regHash = await adminWalletClient.writeContract({
    address: CONTRACT_ADDRESSES.campusAccessControl,
    abi: CAMPUS_ACCESS_CONTROL_ABI,
    functionName: "registerUser",
    args: [account.address, name, ROLE_MAP[role]],
  });
  await publicClient.waitForTransactionReceipt({ hash: regHash });

  // Solo mintear tokens si es STUDENT (los demás roles no los necesitan)
  if (role === "STUDENT") {
    const mintLibHash = await adminWalletClient.writeContract({
      address: CONTRACT_ADDRESSES.libraryToken,
      abi: LIBRARY_TOKEN_ABI,
      functionName: "mint",
      args: [account.address, BigInt(10)],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintLibHash });

    const mintShopHash = await adminWalletClient.writeContract({
      address: CONTRACT_ADDRESSES.shopToken,
      abi: SHOP_TOKEN_ABI,
      functionName: "mint",
      args: [account.address, BigInt(100)],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintShopHash });
  }

  // Guardar en BD
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role,
      address: account.address,
      encryptedKey,
    },
  });

  return NextResponse.json(
    {
      message: "Usuario creado correctamente",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    },
    { status: 201 },
  );
}
