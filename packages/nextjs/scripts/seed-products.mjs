/**
 * seed-products.mjs — Carga el catálogo inicial de productos en la tienda.
 *
 * Idempotente:
 *   - Si Prisma ya tiene N productos (N === JSON.length), salta sin tocar nada.
 *   - Si tanto Prisma como blockchain están vacíos, crea todo (write a chain + Prisma).
 *   - Si Prisma está vacío pero blockchain tiene productos (o viceversa), avisa
 *     de estado inconsistente y pide `pnpm dev:new` — no intenta rehidratar.
 *
 * Pasos por cada producto del JSON (cuando hay que crear):
 * 1. Llama a CampusShop.addProduct(price, stock) → obtiene productId on-chain
 * 2. Crea el registro en Prisma con nombre, descripción, categoría, imagen y el productId
 *
 * Uso: node scripts/seed-products.mjs
 * Se ejecuta automáticamente desde dev.mjs tras el seed del admin.
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

const CAMPUS_SHOP_ADDRESS = "0x0165878A594ca255338adfa4d48449f69242Eb8F";
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

    const expected = productsJson.length;
    const actual = await prisma.product.count();

    // Leer el contador on-chain. Lo que importa es comparar Prisma con la
    // chain, no con el JSON: un usuario puede haber añadido productos via UI
    // posteriormente, en cuyo caso Prisma > expected pero sigue todo en sync.
    let nextProductId;
    try {
      const next = await publicClient.readContract({
        address: CAMPUS_SHOP_ADDRESS,
        abi: CAMPUS_SHOP_ABI,
        functionName: "nextProductId",
      });
      nextProductId = Number(next);
    } catch {
      log(red("  ✗ No se pudo leer nextProductId on-chain. ¿Está el nodo arriba?"));
      return;
    }
    const chainCount = nextProductId - 1;

    // ── Detección de estado y bifurcación de idempotencia ──
    // Caso 1: Prisma y chain en sync, con al menos los del seed → todo bien.
    if (actual === chainCount && actual >= expected) {
      const extras = actual - expected;
      const detail = extras > 0 ? ` · ${extras} añadido(s) por uso` : "";
      log(green(`Ya sincronizado (${actual} productos${detail}). Saltando.`));
      return;
    }

    // Caso 2: ambos a cero → seed inicial.
    if (actual === 0 && chainCount === 0) {
      log(`Sincronizando ${expected} producto(s) de catálogo desde cero...`);
      // continúa al bloque de creación abajo
    }
    // Caso 3: drift real (Prisma y chain no coinciden, o ambos están a medio camino).
    else {
      log(red(`  ✗ Estado inconsistente: Prisma tiene ${actual} producto(s), blockchain ${chainCount}.`));
      log(red(`    Ejecuta 'pnpm db:doctor' para diagnosticar.`));
      return;
    }

    // Helper: derivar slug del grupo desde la imageUrl
    // /products/boligrafo/clip-engomado/azul/main.webp → "boligrafo-clip-engomado"
    function deriveGroupSlug(imageUrl) {
      if (!imageUrl) return null;
      const parts = imageUrl.split("/").filter(Boolean);
      // parts: ["products", "boligrafo", "clip-engomado", "azul", "main.webp"]
      if (parts.length < 4) return null;
      return parts.slice(1, -2).join("-"); // "boligrafo-clip-engomado"
    }

    // Helper: derivar color desde la imageUrl
    function deriveColor(imageUrl) {
      if (!imageUrl) return "default";
      const parts = imageUrl.split("/").filter(Boolean);
      if (parts.length < 3) return "default";
      return parts[parts.length - 2]; // "azul"
    }

    // Helper: derivar nombre base quitando el color del final
    function deriveBaseName(name, color) {
      const displayColor = color.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
      for (const candidate of [displayColor, displayColor.toLowerCase(), displayColor.toUpperCase()]) {
        if (name.endsWith(` ${candidate}`)) {
          return name.slice(0, -(candidate.length + 1)).trim();
        }
      }
      return name;
    }

    // 2. Agrupar productos del JSON por grupo (baseSlug)
    const groupMap = new Map(); // slug → { name, description, category, products[] }

    for (const product of productsJson) {
      const slug = deriveGroupSlug(product.imageUrl) || product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const color = deriveColor(product.imageUrl);
      const baseName = deriveBaseName(product.name, color);

      if (!groupMap.has(slug)) {
        groupMap.set(slug, {
          slug,
          name: baseName,
          description: product.description || null,
          category: product.category || null,
          products: [],
        });
      }
      groupMap.get(slug).products.push({ ...product, color });
    }

    // 3. Crear ProductBase + productos on-chain + Prisma
    let created = 0;
    let skippedCreate = 0;

    for (const [slug, group] of groupMap) {
      // Crear ProductBase
      const base = await prisma.productBase.create({
        data: {
          slug,
          name: group.name,
          description: group.description,
          category: group.category,
        },
      });

      let sortOrder = 0;
      for (const product of group.products) {
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
            baseId: base.id,
            name: product.name,
            description: product.description || null,
            price: product.price,
            stock: product.stock,
            category: product.category || null,
            imageUrl: product.imageUrl || null,
            color: product.color || null,
            sortOrder,
            active: true,
          },
        });

        created += 1;
        sortOrder += 1;
        log(green(`  + Creado #${productId} ${product.name}`));
      }
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
