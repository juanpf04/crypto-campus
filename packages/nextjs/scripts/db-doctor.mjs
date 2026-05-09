/**
 * db-doctor.mjs — Diagnóstico de drift entre Prisma y la blockchain.
 *
 * Para cada entidad con contraparte on-chain:
 *   1. Lee el contador on-chain (nextXId) → calcula entradas on-chain (nextXId - 1).
 *   2. Cuenta filas en Prisma.
 *   3. Si difieren, lista las filas huérfanas (en Prisma sin chain) o IDs
 *      faltantes (en chain sin Prisma).
 *
 * NO modifica nada. Solo diagnostica.
 *
 * Uso: pnpm db:doctor
 */

import { createPublicClient, http } from "viem";
import { hardhat } from "viem/chains";
import prismaClientPkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const { PrismaClient } = prismaClientPkg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const NEXTJS_DIR = resolve(__dirname, "..");
const HARDHAT_DIR = resolve(__dirname, "../../hardhat");

// ── Colores ──
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function log(msg) { console.log(`${cyan("[doctor]")} ${msg}`); }

// ── Cargar .env ──
function loadEnv() {
  const vars = {};
  try {
    const content = readFileSync(resolve(NEXTJS_DIR, ".env"), "utf-8");
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
  } catch { /* no existe */ }
  return vars;
}

// ── ABIs ──
function loadAbi(name) {
  const path = resolve(HARDHAT_DIR, `artifacts/contracts/${name}.sol/${name}.json`);
  return JSON.parse(readFileSync(path, "utf-8")).abi;
}

const ADDRESSES = {
  campusRoles:    "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  libraryToken:   "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  shopToken:      "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
  badgeSystem:    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  libraryManager: "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
  campusShop:     "0x0165878A594ca255338adfa4d48449f69242Eb8F",
  roomBooking:    "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
};

const ABIS = {
  RoomBooking:    loadAbi("RoomBooking"),
  LibraryManager: loadAbi("LibraryManager"),
  CampusShop:     loadAbi("CampusShop"),
  BadgeSystem:    loadAbi("BadgeSystem"),
};

const publicClient = createPublicClient({
  chain: hardhat,
  transport: http("http://127.0.0.1:8545"),
});

// ── Lista de entidades a auditar ──
// `hasHistorical: true` indica que el modelo tiene un flag `historical` que el
// doctor debe ignorar al comparar con la cadena (filas con `historical=true`
// viven solo en Prisma, no consumen ids on-chain).
const ENTITIES = [
  { label: "Rooms",            contract: ADDRESSES.roomBooking,    abi: ABIS.RoomBooking,    counter: "nextRoomId",          model: "room",          idField: "roomId",          txField: "txHash",        hasHistorical: false },
  { label: "Library items",    contract: ADDRESSES.libraryManager, abi: ABIS.LibraryManager, counter: "nextBookId",          model: "libraryItem",   idField: "tokenId",         txField: null,            hasHistorical: false },
  { label: "Loans",            contract: ADDRESSES.libraryManager, abi: ABIS.LibraryManager, counter: "nextLoanId",          model: "loan",          idField: "loanId",          txField: "requestTxHash", hasHistorical: true  },
  { label: "Products",         contract: ADDRESSES.campusShop,     abi: ABIS.CampusShop,     counter: "nextProductId",       model: "product",       idField: "productId",       txField: null,            hasHistorical: false },
  { label: "Order batches",    contract: ADDRESSES.campusShop,     abi: ABIS.CampusShop,     counter: "nextBatchId",         model: "orderBatch",    idField: "batchId",         txField: "txHash",        hasHistorical: true  },
  { label: "Orders",           contract: ADDRESSES.campusShop,     abi: ABIS.CampusShop,     counter: "nextOrderId",         model: "order",         idField: "orderId",         txField: "txHash",        hasHistorical: true  },
  { label: "Subject badges",   contract: ADDRESSES.badgeSystem,    abi: ABIS.BadgeSystem,    counter: "nextSubjectBadgeId",  model: "subjectBadge",  idField: "tokenId",         txField: "txHash",        hasHistorical: false },
  { label: "Assignments",      contract: ADDRESSES.badgeSystem,    abi: ABIS.BadgeSystem,    counter: "nextAssignmentId",    model: "assignment",    idField: "assignmentId",    txField: "txHash",        hasHistorical: false },
  { label: "Prize categories", contract: ADDRESSES.badgeSystem,    abi: ABIS.BadgeSystem,    counter: "nextPrizeCategoryId", model: "prizeCategory", idField: "prizeCategoryId", txField: "txHash",        hasHistorical: false },
  { label: "Rewards",          contract: ADDRESSES.badgeSystem,    abi: ABIS.BadgeSystem,    counter: "nextRewardId",        model: "reward",        idField: "rewardId",        txField: "txHash",        hasHistorical: false },
  { label: "Use requests",     contract: ADDRESSES.badgeSystem,    abi: ABIS.BadgeSystem,    counter: "nextUseRequestId",    model: "useRequest",    idField: "requestId",       txField: "txHash",        hasHistorical: false },
];

const MAX_ORPHAN_DETAILS = 10;

async function checkEntity(prisma, entity) {
  let onChainCount;
  try {
    const nextId = await publicClient.readContract({
      address: entity.contract,
      abi: entity.abi,
      functionName: entity.counter,
    });
    onChainCount = Number(nextId) - 1;
  } catch (err) {
    log(red(`✗ ${entity.label}: no se pudo leer ${entity.counter} on-chain (${err.message})`));
    return { ok: false, label: entity.label };
  }

  // Para modelos con flag `historical`, ignoramos las filas históricas:
  // viven solo en Prisma (sin id on-chain) y no deben contar como drift.
  const liveOnlyWhere = entity.hasHistorical ? { historical: false } : {};
  const prismaCount = await prisma[entity.model].count({ where: liveOnlyWhere });

  // Reportamos las históricas como información extra (no son drift).
  let historicalCount = 0;
  if (entity.hasHistorical) {
    historicalCount = await prisma[entity.model].count({ where: { historical: true } });
  }

  if (onChainCount === prismaCount) {
    const histInfo = historicalCount > 0 ? dim(` (+${historicalCount} histórico${historicalCount === 1 ? "" : "s"} solo Prisma)`) : "";
    log(green(`✓ ${entity.label}: ${prismaCount} en sync${histInfo}`));
    return { ok: true, label: entity.label };
  }

  // Caso A: Prisma tiene de más → filas huérfanas (creadas en Prisma sin contrapartida on-chain válida).
  if (prismaCount > onChainCount) {
    const diff = prismaCount - onChainCount;
    const histInfo = historicalCount > 0 ? dim(` (+${historicalCount} histórico${historicalCount === 1 ? "" : "s"} ignorado${historicalCount === 1 ? "" : "s"})`) : "";
    log(red(`✗ ${entity.label}: Prisma=${prismaCount}, chain=${onChainCount} → ${diff} fila(s) huérfana(s) en Prisma${histInfo}`));

    const select = { id: true, [entity.idField]: true };
    if (entity.txField) select[entity.txField] = true;
    const orphans = await prisma[entity.model].findMany({
      where: {
        [entity.idField]: { gt: onChainCount },
        ...liveOnlyWhere,
      },
      select,
      orderBy: { [entity.idField]: "asc" },
      take: MAX_ORPHAN_DETAILS,
    });
    for (const o of orphans) {
      const txInfo = entity.txField ? ` ${entity.txField}=${o[entity.txField] || dim("(null)")}` : "";
      log(yellow(`    ⤷ ${entity.idField}=${o[entity.idField]} (id=${o.id})${txInfo}`));
    }
    if (diff > MAX_ORPHAN_DETAILS) {
      log(dim(`    ... y ${diff - MAX_ORPHAN_DETAILS} más`));
    }
    return { ok: false, label: entity.label, drift: "prisma-extra", diff };
  }

  // Caso B: chain tiene de más → IDs on-chain sin fila Prisma.
  const diff = onChainCount - prismaCount;
  log(red(`✗ ${entity.label}: Prisma=${prismaCount}, chain=${onChainCount} → ${diff} ID(s) on-chain sin Prisma`));

  const inPrisma = await prisma[entity.model].findMany({
    select: { [entity.idField]: true },
  });
  const inPrismaSet = new Set(inPrisma.map((r) => r[entity.idField]));
  const missing = [];
  for (let i = 1; i <= onChainCount; i++) {
    if (!inPrismaSet.has(i)) missing.push(i);
  }
  for (const id of missing.slice(0, MAX_ORPHAN_DETAILS)) {
    log(yellow(`    ⤷ falta en Prisma: ${entity.idField}=${id}`));
  }
  if (missing.length > MAX_ORPHAN_DETAILS) {
    log(dim(`    ... y ${missing.length - MAX_ORPHAN_DETAILS} más`));
  }
  return { ok: false, label: entity.label, drift: "chain-extra", diff };
}

// ── Main ──
async function main() {
  const env = loadEnv();
  const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(red("DATABASE_URL no encontrada. ¿Está creado packages/nextjs/.env?"));
    process.exit(1);
  }
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  log(`Diagnóstico de sincronía Prisma ↔ blockchain (Anvil 127.0.0.1:8545)`);
  console.log("");

  // Comprobar que Anvil responde
  try {
    await publicClient.getBlockNumber();
  } catch {
    console.error(red("[doctor] ✗ Anvil no responde en 127.0.0.1:8545."));
    console.error(red("         Arranca el nodo en otra terminal con `pnpm dev` (rápido) o `pnpm dev:new` (reset + sembrado)."));
    await prisma.$disconnect();
    process.exit(1);
  }

  const results = [];
  try {
    for (const entity of ENTITIES) {
      const result = await checkEntity(prisma, entity);
      results.push(result);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("");
  const okCount = results.filter((r) => r.ok).length;
  const drifts = results.filter((r) => !r.ok);

  if (drifts.length === 0) {
    log(green(`═══ Todo en sincronía: ${okCount}/${ENTITIES.length} entidades OK`));
    return;
  }

  log(yellow(`═══ Drift detectado en ${drifts.length}/${ENTITIES.length} entidad(es): ${drifts.map((d) => d.label).join(", ")}`));
  console.log("");
  log(dim("Cómo proceder:"));
  log(dim(`  - Filas Prisma huérfanas (con txHash null): borrar manualmente en Prisma Studio.`));
  log(dim(`  - Filas Prisma huérfanas (con txHash real): la tx existió on-chain pero se perdió. Reset: 'pnpm dev:new'.`));
  log(dim(`  - IDs on-chain sin Prisma: probable caída de servidor a mitad de creación. Revisar logs.`));
  log(dim(`  - Filas históricas (idField=null, historical=true): NO son drift, son datos sembrados solo en Prisma para gráficas.`));
  log(dim(`  - Si dudas: 'pnpm dev:new' garantiza sincronía total (resetea chain + BD y resembra).`));
  process.exit(1);
}

main().catch((err) => {
  console.error(red("[doctor] error fatal:"), err);
  process.exit(1);
});
