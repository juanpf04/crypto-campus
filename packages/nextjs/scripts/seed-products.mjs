/**
 * seed-products.mjs — Carga el catálogo inicial de productos en la tienda.
 *
 * Es idempotente: si ya existen productos en la BD, no hace nada.
 *
 * Pasos por cada producto del JSON:
 * 1. Llama a CampusShop.addProduct(price, stock) → obtiene productId on-chain
 * 2. Crea el registro en Prisma con nombre, descripción, categoría, imagen y el productId
 *
 * Uso: node scripts/seed-products.mjs
 * Se ejecuta automáticamente desde dev.mjs tras el seed del admin.
 */

import { createPublicClient, createWalletClient, http } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Colores para consola ──
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

function log(msg) {
  console.log(`${cyan("[seed-products]")} ${msg}`);
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

// ── ABI y dirección de CampusShop ──
const HARDHAT_DIR = resolve(__dirname, "../../hardhat");
const artifactsDir = resolve(HARDHAT_DIR, "artifacts/contracts");

function loadAbi(contractName) {
  const path = resolve(artifactsDir, `${contractName}.sol/${contractName}.json`);
  return JSON.parse(readFileSync(path, "utf-8")).abi;
}

const CAMPUS_SHOP_ADDRESS = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
const CAMPUS_SHOP_ABI = loadAbi("CampusShop");

// ── Clientes viem ──
const publicClient = createPublicClient({
  chain: hardhat,
  transport: http("http://127.0.0.1:8545"),
});

// Account[0] de Hardhat = admin/deployer
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
    // Cargar JSON de productos
    const productsJson = JSON.parse(
      readFileSync(resolve(__dirname, "../prisma/seed-products.json"), "utf-8")
    );

    log(`Sincronizando ${productsJson.length} producto(s) de catálogo...`);

    // 1. Limpiar productos y órdenes anteriores de Prisma.
    //    Hasta que se implemente Anvil state persistence, la blockchain se reinicia
    //    en cada pnpm dev, así que los productos viejos en Prisma son huérfanos.
    const deleted = await prisma.order.deleteMany({});
    const deletedProducts = await prisma.product.deleteMany({});
    if (deletedProducts.count > 0) {
      log(yellow(`  ⚠ Limpiados ${deletedProducts.count} producto(s) y ${deleted.count} orden(es) huérfanos de Prisma`));
    }

    // 2. Crear cada producto on-chain + Prisma desde cero
    let created = 0;
    let skippedCreate = 0;

    for (const product of productsJson) {
      let productId;
      try {
        const nextProductId = await publicClient.readContract({
          address: CAMPUS_SHOP_ADDRESS,
          abi: CAMPUS_SHOP_ABI,
          functionName: "nextProductId",
        });
        productId = Number(nextProductId);

        const hash = await adminWalletClient.writeContract({
          address: CAMPUS_SHOP_ADDRESS,
          abi: CAMPUS_SHOP_ABI,
          functionName: "addProduct",
          args: [BigInt(product.price), BigInt(product.stock)],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status !== "success") {
          skippedCreate += 1;
          log(yellow(`  ⚠ No creado on-chain (tx revertida): ${product.name}`));
          continue;
        }
      } catch {
        skippedCreate += 1;
        log(yellow(`  ⚠ No creado on-chain (nodo no disponible): ${product.name}`));
        continue;
      }

      await prisma.product.create({
        data: {
          productId,
          name: product.name,
          description: product.description || null,
          price: product.price,
          stock: product.stock,
          category: product.category || null,
          imageUrl: product.imageUrl || null,
          active: true,
        },
      });

      created += 1;
      log(green(`  + Creado #${productId} ${product.name}`));
    }

    log(green(`Sync completado. Creados: ${created}, no creados on-chain: ${skippedCreate}`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
