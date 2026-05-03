/**
 * resync-users.mjs
 *
 * Sincroniza los usuarios de Prisma con la blockchain. Idempotente:
 * para cada usuario consulta CampusRoles.isRegistered(address) y solo
 * fondea/registra/mintea si no está ya registrado on-chain.
 *
 *   1. Fondea cada wallet nueva con ETH (gas)
 *   2. Registra el usuario en CampusRoles con su rol
 *   3. Mintea tokens iniciales (LibraryToken + ShopToken) a estudiantes/profesores
 *
 * Se ejecuta automáticamente desde dev.mjs tras el deploy de contratos.
 *
 * Uso: node scripts/resync-users.mjs
 */

import { createPublicClient, createWalletClient, http, parseEther, keccak256, toBytes } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import prismaClientPkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createDecipheriv } from "crypto";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const { PrismaClient } = prismaClientPkg;

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Colores para consola ──
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

function log(msg) {
  console.log(`${cyan("[resync]")} ${msg}`);
}

// ── Cargar .env manualmente (no podemos usar dotenv porque es ESM puro) ──
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
        // Quitar comillas
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        vars[key] = val;
      }
    } catch { /* archivo no existe, siguiente */ }
  }
  return vars;
}

const env = loadEnv();
const SESSION_SECRET = env.SESSION_SECRET || process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  log(yellow("No se encontró SESSION_SECRET — no se pueden descifrar las wallets. Saltando resync."));
  process.exit(0);
}

// ── Descifrar clave privada (misma lógica que src/lib/crypto.ts) ──
function decrypt(data) {
  const KEY = Buffer.from(SESSION_SECRET.padEnd(32, "0").slice(0, 32));
  const [ivHex, authTagHex, encrypted] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ── Leer ABIs y direcciones ──
const HARDHAT_DIR = resolve(__dirname, "../../hardhat");
const artifactsDir = resolve(HARDHAT_DIR, "artifacts/contracts");

function loadAbi(contractName) {
  const path = resolve(artifactsDir, `${contractName}.sol/${contractName}.json`);
  return JSON.parse(readFileSync(path, "utf-8")).abi;
}

// Direcciones desplegadas (deterministas en Hardhat)
const ADDRESSES = {
  campusRoles:         "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  libraryToken:        "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  shopToken:           "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
};

const ROLE_MAP = {
  STUDENT:   keccak256(toBytes("STUDENT_ROLE")),
  PROFESSOR: keccak256(toBytes("PROFESSOR_ROLE")),
  LIBRARIAN: keccak256(toBytes("LIBRARIAN_ROLE")),
  ADMIN:     keccak256(toBytes("ADMIN_ROLE")),
};

const CAMPUS_ABI = loadAbi("CampusRoles");
const LIB_TOKEN_ABI = loadAbi("LibraryToken");
const SHOP_TOKEN_ABI = loadAbi("ShopToken");

// ── Clientes viem ──
const publicClient = createPublicClient({
  chain: hardhat,
  transport: http("http://127.0.0.1:8545"),
});

// Account[0] de Hardhat = admin
const ADMIN_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const adminAccount = privateKeyToAccount(ADMIN_PRIVATE_KEY);
const adminWalletClient = createWalletClient({
  account: adminAccount,
  chain: hardhat,
  transport: http("http://127.0.0.1:8545"),
});

/**
 * Espera el receipt y lanza si la tx revirtió. Sin esto, una tx revertida
 * deja huérfana la fila Prisma posterior porque viem NO lanza por sí solo.
 */
async function txWaitOrThrow(hash, label = "tx") {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`${label} revertida (hash=${hash})`);
  }
  return receipt;
}

// ── Main ──
async function main() {
  const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const users = await prisma.user.findMany();

    if (users.length === 0) {
      log("No hay usuarios en la base de datos. Nada que resincronizar.");
      return;
    }

    log(`Resincronizando ${users.length} usuario(s) con la blockchain...`);

    let registered = 0;
    let alreadySynced = 0;
    let failed = 0;

    for (const user of users) {
      try {
        // 1. Descifrar clave privada
        const privateKey = decrypt(user.encryptedKey);
        const account = privateKeyToAccount(privateKey);

        // Verificar que la address coincide
        if (account.address.toLowerCase() !== user.address.toLowerCase()) {
          log(yellow(`  ⚠ Address mismatch para ${user.email} — saltando`));
          failed += 1;
          continue;
        }

        // 2. ¿Ya está registrado on-chain? Si sí, no hacemos nada (idempotencia).
        const isRegistered = await publicClient.readContract({
          address: ADDRESSES.campusRoles,
          abi: CAMPUS_ABI,
          functionName: "isRegistered",
          args: [account.address],
        });

        if (isRegistered) {
          alreadySynced += 1;
          continue;
        }

        // 3. Fondear wallet con ETH
        const fundHash = await adminWalletClient.sendTransaction({
          to: account.address,
          value: parseEther("10"),
        });
        await txWaitOrThrow(fundHash, "fund wallet");

        // 4. Registrar en CampusRoles
        const role = ROLE_MAP[user.role] || ROLE_MAP.STUDENT;
        const regHash = await adminWalletClient.writeContract({
          address: ADDRESSES.campusRoles,
          abi: CAMPUS_ABI,
          functionName: "registerUser",
          args: [account.address, user.name, role],
        });
        await txWaitOrThrow(regHash, "registerUser");

        // 5. Mintear tokens iniciales (solo a estudiantes y profesores)
        if (user.role === "STUDENT" || user.role === "PROFESSOR") {
          const mintLibHash = await adminWalletClient.writeContract({
            address: ADDRESSES.libraryToken,
            abi: LIB_TOKEN_ABI,
            functionName: "mint",
            args: [account.address, BigInt(10)],
          });
          await txWaitOrThrow(mintLibHash, "mint LibraryToken");

          const mintShopHash = await adminWalletClient.writeContract({
            address: ADDRESSES.shopToken,
            abi: SHOP_TOKEN_ABI,
            functionName: "mint",
            args: [account.address, BigInt(100)],
          });
          await txWaitOrThrow(mintShopHash, "mint ShopToken");
        }

        registered += 1;
        log(green(`  ✓ ${user.email} (${user.role}) — registrado, +10 ETH${user.role === "STUDENT" || user.role === "PROFESSOR" ? ", +10 LIB, +100 SHOP" : ""}`));
      } catch (err) {
        failed += 1;
        log(yellow(`  ✗ ${user.email}: ${err.message}`));
      }
    }

    const summary = `Resincronización: ${registered} nuevo(s) · ${alreadySynced} ya sincronizado(s)${failed > 0 ? ` · ${failed} fallo(s)` : ""}.`;
    log(failed > 0 ? yellow(summary) : green(summary));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
