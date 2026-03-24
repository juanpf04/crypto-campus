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

    // 0. Migrar rutas legacy para evitar 404 por cambios de estructura
    const legacyPrefixMap = [
      ["/products/sudadera-basica/", "/products/sudadera/basica/"],
      ["/products/sudadera-capucha/", "/products/sudadera/capucha/"],
      ["/products/camiseta-basica/", "/products/camiseta/basica/"],
      ["/products/camiseta-complutense/", "/products/camiseta/complutense/"],
      ["/products/camiseta-new/", "/products/camiseta/new/"],
    ];

    const allProductsBefore = await prisma.product.findMany({
      select: { id: true, imageUrl: true },
    });

    for (const p of allProductsBefore) {
      if (!p.imageUrl) continue;
      let migrated = p.imageUrl;
      for (const [fromPrefix, toPrefix] of legacyPrefixMap) {
        if (migrated.startsWith(fromPrefix)) {
          migrated = migrated.replace(fromPrefix, toPrefix);
        }
      }

      if (migrated !== p.imageUrl) {
        await prisma.product.update({
          where: { id: p.id },
          data: { imageUrl: migrated },
        });
      }
    }

    const existingProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        imageUrl: true,
        productId: true,
        active: true,
      },
    });

    const byImageUrl = new Map(
      existingProducts
        .filter((p) => p.imageUrl)
        .map((p) => [p.imageUrl, p])
    );

    const byName = new Map(
      existingProducts.map((p) => [p.name.trim().toLowerCase(), p])
    );

    const syncedIds = new Set();

    let created = 0;
    let updated = 0;
    let skippedCreate = 0;

    for (const product of productsJson) {
      const existing = byImageUrl.get(product.imageUrl) || byName.get(product.name.trim().toLowerCase());

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            name: product.name,
            description: product.description || null,
            price: product.price,
            stock: product.stock,
            category: product.category || null,
            imageUrl: product.imageUrl || null,
            active: true,
          },
        });

        syncedIds.add(existing.id);
        updated += 1;
        log(green(`  ↺ Actualizado #${existing.productId} ${product.name}`));
        continue;
      }

      // Crear faltantes: on-chain + Prisma
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

      let createdProduct;
      try {
        createdProduct = await prisma.product.create({
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
      } catch (error) {
        // Si la chain local se ha reiniciado, productId on-chain puede colisionar
        // con IDs persistidos en Prisma. Reasignamos un ID libre en BD para no
        // bloquear el sincronizado del catálogo visual.
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
          const maxProductId = await prisma.product.aggregate({
            _max: { productId: true },
          });
          const fallbackProductId = (maxProductId._max.productId ?? 0) + 1;

          createdProduct = await prisma.product.create({
            data: {
              productId: fallbackProductId,
              name: product.name,
              description: product.description || null,
              price: product.price,
              stock: product.stock,
              category: product.category || null,
              imageUrl: product.imageUrl || null,
              active: true,
            },
          });

          log(yellow(`  ⚠ Colisión productId on-chain (${productId}) para ${product.name}; asignado productId BD ${fallbackProductId}`));
        } else {
          throw error;
        }
      }

      syncedIds.add(createdProduct.id);
      created += 1;
      log(green(`  + Creado #${productId} ${product.name}`));
    }

    // Desactivar productos que no estén en el catálogo JSON
    const staleIds = existingProducts
      .map((p) => p.id)
      .filter((id) => !syncedIds.has(id));

    if (staleIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: staleIds } },
        data: { active: false },
      });
    }

    log(green(`Sync completado. Actualizados: ${updated}, creados: ${created}, desactivados: ${staleIds.length}, no creados on-chain: ${skippedCreate}`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
