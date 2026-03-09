import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { parseEther } from "viem";
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

export async function POST(req: NextRequest) {
  // ─── 1. Leer el body del request ───
  // El frontend envía: { email, password, name }
  const { email, password, name } = await req.json();

  // ─── 2. Validación básica ───
  // Comprobamos que los campos obligatorios estén presentes
  if (!email || !password || !name) {
    return NextResponse.json(
      { error: "Email, contraseña y nombre son obligatorios" },
      { status: 400 }
    );
  }

  // ─── 2b. Validar dominio del email ───
  // Solo se permite registro con email institucional de la UCM.
  // Este endpoint es exclusivo para estudiantes.
  // Otros roles (profesor, bibliotecario) los crea el admin.
  if (!email.endsWith("@ucm.es")) {
    return NextResponse.json(
      { error: "Solo se permiten emails institucionales (@ucm.es)" },
      { status: 400 }
    );
  }

  // ─── 3. Comprobar si el email ya existe ───
  // Buscamos en la base de datos si ya hay un usuario con ese email
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "El email ya está registrado" },
      { status: 409 } // 409 = Conflict
    );
  }

  // ─── 4. Hashear la contraseña ───
  // Nunca guardamos la contraseña en texto plano.
  // bcrypt genera un hash irreversible con salt incluido.
  // El "10" es el número de rondas de salt (estándar).
  const hashedPassword = await hash(password, 10);

  // ─── 5. Generar la wallet del usuario ───
  // generatePrivateKey() crea una clave privada aleatoria (256 bits).
  // privateKeyToAccount() deriva la dirección pública (0x...) a partir de ella.
  // El usuario NUNCA ve ni la clave ni la dirección.
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  // ─── 6. Cifrar la clave privada ───
  // Antes de guardarla en la DB, la ciframos con AES-256-GCM.
  // Solo nuestro backend puede descifrarla (usando SESSION_SECRET).
  const encryptedKey = encrypt(privateKey);

  // ─── 7. Fondear la wallet desde el admin ───
  // El account[0] de Hardhat (admin) envía ETH a la nueva wallet.
  // Este ETH es necesario para pagar el "gas" de las transacciones.
  // En Hardhat local el ETH es gratis e ilimitado.
  await adminWalletClient.sendTransaction({
    to: account.address,
    value: parseEther("1000"), // 1000 ETH de gas para operar
  });

  // ─── 8. Registrar en el contrato CampusAccessControl ───
  // Sin este paso los contratos no reconocerían al usuario (isStudent devolvería false).
  // El admin llama a registerUser(address, name, STUDENT_ROLE) en nombre del estudiante.
  const registerHash = await adminWalletClient.writeContract({
    address: CONTRACT_ADDRESSES.campusAccessControl,
    abi: CAMPUS_ACCESS_CONTROL_ABI,
    functionName: "registerUser",
    args: [account.address, name, ROLES.STUDENT],
  });
  // Esperamos confirmación de la tx antes de continuar
  await publicClient.waitForTransactionReceipt({ hash: registerHash });

  // ─── 9. Mintear tokens iniciales al estudiante ───
  // LibraryToken: 10 tokens = 10 slots de préstamo simultáneos
  // ShopToken: 100 tokens = saldo inicial para la tienda
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

  // ─── 10. Guardar el usuario en la base de datos ───
  // Guardamos todo en PostgreSQL vía Prisma:
  // - email y nombre para identificación
  // - password hasheado (irreversible)
  // - address: la dirección pública de la wallet generada
  // - encryptedKey: la clave privada cifrada (para firmar txs después)
  // - role: por defecto "STUDENT" (el admin lo puede cambiar luego)
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      address: account.address,
      encryptedKey,
    },
  });

  // ─── 9. Responder al frontend ───
  // Devolvemos solo los datos públicos, NUNCA la clave privada.
  return NextResponse.json(
    {
      message: "Usuario registrado correctamente",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    },
    { status: 201 } // 201 = Created
  );
}
