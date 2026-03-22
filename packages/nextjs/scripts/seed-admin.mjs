/**
 * seed-admin.mjs — Crea el usuario administrador por defecto.
 *
 * Es idempotente: si el admin ya existe en la BD, no hace nada.
 *
 * Pasos:
 * 1. Comprueba si ya existe un usuario con email admin@ucm.es
 * 2. Hashea la contraseña con bcryptjs
 * 3. Genera un wallet Ethereum (clave privada + dirección)
 * 4. Cifra la clave privada con AES-256-GCM
 * 5. Fondea la wallet con ETH (para gas en futuras transacciones)
 * 6. Registra al admin en CampusRoles con ADMIN_ROLE
 * 7. Guarda en PostgreSQL con rol ADMIN
 *
 * NO mintea tokens (LIB/SHOP) porque el admin es un rol de organización,
 * no un usuario que use la biblioteca o la tienda.
 *
 * Uso: node scripts/seed-admin.mjs
 * Se ejecuta automáticamente desde dev.mjs tras el resync de usuarios.
 */

import { createPublicClient, createWalletClient, http, parseEther, keccak256, toBytes } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createCipheriv, randomBytes } from "crypto";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Colores para consola ──
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

function log(msg) {
  console.log(`${cyan("[seed-admin]")} ${msg}`);
}

// ── Cargar .env manualmente ──
function loadEnv() {
  const envPaths = [resolve(__dirname, "../.env")];
  const vars = {};
  for (const p of envPaths) {
    try {
      const content = readFileSync(p, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        vars[key] = val;
      }
    } catch { /* archivo no existe */ }
  }
  return vars;
}

const env = loadEnv();
const SESSION_SECRET = env.SESSION_SECRET || process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  log(yellow("No se encontró SESSION_SECRET. Saltando seed."));
  process.exit(0);
}

// ── Cifrado AES-256-GCM (misma lógica que src/lib/crypto.ts) ──
function encrypt(text) {
  const KEY = Buffer.from(SESSION_SECRET.padEnd(32, "0").slice(0, 32));
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

// ── ABIs y direcciones ──
const HARDHAT_DIR = resolve(__dirname, "../../hardhat");
const artifactsDir = resolve(HARDHAT_DIR, "artifacts/contracts");

function loadAbi(contractName) {
  const path = resolve(artifactsDir, `${contractName}.sol/${contractName}.json`);
  return JSON.parse(readFileSync(path, "utf-8")).abi;
}

const ADDRESSES = {
  campusRoles: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
};

// ADMIN_ROLE custom = keccak256("ADMIN_ROLE")
const ADMIN_ROLE_HASH = keccak256(toBytes("ADMIN_ROLE"));

const CAMPUS_ABI = loadAbi("CampusRoles");

// ── Clientes viem ──
const publicClient = createPublicClient({
  chain: hardhat,
  transport: http("http://127.0.0.1:8545"),
});

const ADMIN_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const adminAccount = privateKeyToAccount(ADMIN_PRIVATE_KEY);
const adminWalletClient = createWalletClient({
  account: adminAccount,
  chain: hardhat,
  transport: http("http://127.0.0.1:8545"),
});

// ── Datos del admin por defecto ──
const ADMIN_EMAIL = "admin@ucm.es";
const ADMIN_PASSWORD = "Admin^12";
const ADMIN_NAME = "Administrador";

// ── Main ──
async function main() {
  const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Comprobar si ya existe
    const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (existing) {
      log(green(`Admin ya existe (${ADMIN_EMAIL}). Saltando.`));
      return;
    }

    log("Creando usuario administrador por defecto...");

    // 2. Hashear contraseña
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    // 3. Generar wallet
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    // 4. Cifrar clave privada
    const encryptedKey = encrypt(privateKey);

    // 5. Fondear wallet con ETH (para gas)
    const fundHash = await adminWalletClient.sendTransaction({
      to: account.address,
      value: parseEther("10"),
    });
    await publicClient.waitForTransactionReceipt({ hash: fundHash });

    // 6. Registrar en CampusRoles con DEFAULT_ADMIN_ROLE
    const regHash = await adminWalletClient.writeContract({
      address: ADDRESSES.campusRoles,
      abi: CAMPUS_ABI,
      functionName: "registerUser",
      args: [account.address, ADMIN_NAME, ADMIN_ROLE_HASH],
    });
    await publicClient.waitForTransactionReceipt({ hash: regHash });

    // 7. Guardar en PostgreSQL
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        password: hashedPassword,
        name: ADMIN_NAME,
        role: "ADMIN",
        address: account.address,
        encryptedKey,
      },
    });

    log(green(`Admin creado: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
