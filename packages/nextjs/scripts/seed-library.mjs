/**
 * seed-library.mjs — Carga el catálogo inicial de la biblioteca.
 *
 * Idempotente: si ya existen ítems en la BD, no hace nada.
 *
 * Pasos por cada ítem del JSON:
 * 1. Llama a LibraryManager.addBook(copies) → obtiene tokenId on-chain
 * 2. Crea el registro en Prisma (LibraryItem) con metadatos completos
 *
 * Uso: node scripts/seed-library.mjs
 * Se ejecuta automáticamente desde dev.mjs tras el seed de productos.
 */

import { createPublicClient, createWalletClient, http } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import prismaClientPkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
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
  console.log(`${cyan("[seed-library]")} ${msg}`);
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

// ── ABI y dirección de LibraryManager ──
const HARDHAT_DIR = resolve(__dirname, "../../hardhat");
const artifactsDir = resolve(HARDHAT_DIR, "artifacts/contracts");

function loadAbi(contractName) {
  const path = resolve(artifactsDir, `${contractName}.sol/${contractName}.json`);
  return JSON.parse(readFileSync(path, "utf-8")).abi;
}

const LIBRARY_MANAGER_ADDRESS = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
const LIBRARY_MANAGER_ABI = loadAbi("LibraryManager");

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

// ── Main ──
async function main() {
  const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const itemsJson = JSON.parse(
      readFileSync(resolve(__dirname, "../prisma/seed-library.json"), "utf-8")
    );

    log(`Sincronizando ${itemsJson.length} ítem(s) de biblioteca...`);

    // 1. Limpiar ítems y préstamos anteriores (blockchain se reinicia con cada pnpm dev)
    const deletedLoans = await prisma.loan.deleteMany({});
    const deletedItems = await prisma.libraryItem.deleteMany({});
    if (deletedItems.count > 0) {
      log(yellow(`  ⚠ Limpiados ${deletedItems.count} ítem(s) y ${deletedLoans.count} préstamo(s) huérfanos`));
    }

    // 2. Crear ítems on-chain + Prisma
    let created = 0;
    let skipped = 0;

    for (const item of itemsJson) {
      let tokenId;
      try {
        const nextBookId = await publicClient.readContract({
          address: LIBRARY_MANAGER_ADDRESS,
          abi: LIBRARY_MANAGER_ABI,
          functionName: "nextBookId",
        });
        tokenId = Number(nextBookId);

        const hash = await adminWalletClient.writeContract({
          address: LIBRARY_MANAGER_ADDRESS,
          abi: LIBRARY_MANAGER_ABI,
          functionName: "addBook",
          args: [BigInt(item.copies)],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status !== "success") {
          skipped += 1;
          log(yellow(`  ⚠ No creado on-chain (tx revertida): ${item.title}`));
          continue;
        }
      } catch {
        skipped += 1;
        log(yellow(`  ⚠ No creado on-chain (nodo no disponible): ${item.title}`));
        continue;
      }

      await prisma.libraryItem.create({
        data: {
          tokenId,
          type: item.type,
          title: item.title,
          creator: item.creator || null,
          description: item.description || null,
          category: item.category || null,
          physicalLocation: item.physicalLocation || null,
          physicalCondition: "Bueno",
          totalCopies: item.copies,
          metadata: item.metadata || undefined,
          active: true,
        },
      });

      created += 1;
      log(green(`  + #${tokenId} ${item.title} (${item.copies} copias)`));
    }

    log(green(`Sync completado. Creados: ${created}, no creados on-chain: ${skipped}`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
