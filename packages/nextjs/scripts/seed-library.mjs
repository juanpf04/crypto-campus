/**
 * seed-library.mjs — Carga el catálogo inicial de la biblioteca.
 *
 * Idempotente:
 *   - Si Prisma ya tiene N ítems (N === JSON.length), salta sin tocar nada.
 *   - Si tanto Prisma como blockchain están vacíos, crea todo (write a chain + Prisma).
 *   - Si solo uno de los dos lados tiene datos, avisa de estado inconsistente
 *     y pide `pnpm dev:new` — no intenta rehidratar.
 *
 * Pasos por cada ítem del JSON (cuando hay que crear):
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
const red = (s) => `\x1b[31m${s}\x1b[0m`;

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

    const expected = itemsJson.length;
    const actual = await prisma.libraryItem.count();

    // Leer el contador on-chain. Lo que importa es comparar Prisma con la
    // chain, no con el JSON: un usuario puede haber añadido ítems via UI
    // posteriormente, en cuyo caso Prisma > expected pero sigue todo en sync.
    let nextBookId;
    try {
      const next = await publicClient.readContract({
        address: LIBRARY_MANAGER_ADDRESS,
        abi: LIBRARY_MANAGER_ABI,
        functionName: "nextBookId",
      });
      nextBookId = Number(next);
    } catch {
      log(red("  ✗ No se pudo leer nextBookId on-chain. ¿Está el nodo arriba?"));
      return;
    }
    const chainCount = nextBookId - 1;

    // ── Detección de estado y bifurcación de idempotencia ──
    // Caso 1: Prisma y chain en sync, con al menos los del seed → todo bien.
    if (actual === chainCount && actual >= expected) {
      const extras = actual - expected;
      const detail = extras > 0 ? ` · ${extras} añadido(s) por uso` : "";
      log(green(`Ya sincronizado (${actual} ítems${detail}). Saltando.`));
      return;
    }

    // Caso 2: ambos a cero → seed inicial.
    if (actual === 0 && chainCount === 0) {
      log(`Sincronizando ${expected} ítem(s) de biblioteca desde cero...`);
      // continúa al bloque de creación abajo
    }
    // Caso 3: drift real (Prisma y chain no coinciden, o ambos están a medio camino).
    else {
      log(red(`  ✗ Estado inconsistente: Prisma tiene ${actual} ítem(s), blockchain ${chainCount}.`));
      log(red(`    Ejecuta 'pnpm db:doctor' para diagnosticar.`));
      return;
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
