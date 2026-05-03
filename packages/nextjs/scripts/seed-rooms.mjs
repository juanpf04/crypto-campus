/**
 * seed-rooms.mjs — Carga las salas de estudio por defecto.
 *
 * Idempotente:
 *   - Si Prisma ya tiene N salas (N === JSON.length), salta sin tocar nada.
 *   - Si tanto Prisma como blockchain están vacíos, crea todo (write a chain + Prisma).
 *   - Si solo uno de los dos lados tiene datos, avisa de estado inconsistente
 *     y pide `pnpm dev:new` — no intenta rehidratar.
 *
 * Pasos por cada sala del JSON (cuando hay que crear):
 * 1. Llama a RoomBooking.addRoom(capacity) → obtiene roomId on-chain
 * 2. Crea el registro en Prisma (Room) con metadatos
 *
 * Uso: node scripts/seed-rooms.mjs
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

const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

function log(msg) {
  console.log(`${cyan("[seed-rooms]")} ${msg}`);
}

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
    } catch { /* no existe */ }
  }
  return vars;
}

const env = loadEnv();

const HARDHAT_DIR = resolve(__dirname, "../../hardhat");
const artifactsDir = resolve(HARDHAT_DIR, "artifacts/contracts");

function loadAbi(contractName) {
  const path = resolve(artifactsDir, `${contractName}.sol/${contractName}.json`);
  return JSON.parse(readFileSync(path, "utf-8")).abi;
}

const ROOM_BOOKING_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
const ROOM_BOOKING_ABI = loadAbi("RoomBooking");

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

async function main() {
  const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const roomsJson = JSON.parse(
      readFileSync(resolve(__dirname, "../prisma/seed-rooms.json"), "utf-8")
    );

    const expected = roomsJson.length;
    const actual = await prisma.room.count();

    // Leer el contador on-chain. Lo que importa es comparar Prisma con la
    // chain, no con el JSON: un usuario puede haber añadido salas via UI
    // posteriormente, en cuyo caso Prisma > expected pero sigue todo en sync.
    let nextRoomId;
    try {
      const next = await publicClient.readContract({
        address: ROOM_BOOKING_ADDRESS,
        abi: ROOM_BOOKING_ABI,
        functionName: "nextRoomId",
      });
      nextRoomId = Number(next);
    } catch {
      log(red("  ✗ No se pudo leer nextRoomId on-chain. ¿Está el nodo arriba?"));
      return;
    }
    const chainCount = nextRoomId - 1;

    // ── Detección de estado y bifurcación de idempotencia ──
    // Caso 1: Prisma y chain en sync, con al menos los del seed → todo bien.
    if (actual === chainCount && actual >= expected) {
      const extras = actual - expected;
      const detail = extras > 0 ? ` · ${extras} añadida(s) por uso` : "";
      log(green(`Ya sincronizado (${actual} salas${detail}). Saltando.`));
      return;
    }

    // Caso 2: ambos a cero → seed inicial.
    if (actual === 0 && chainCount === 0) {
      log(`Sincronizando ${expected} sala(s) desde cero...`);
      // continúa al bloque de creación abajo
    }
    // Caso 3: drift real (Prisma y chain no coinciden, o ambos están a medio camino).
    else {
      log(red(`  ✗ Estado inconsistente: Prisma tiene ${actual} sala(s), blockchain ${chainCount}.`));
      log(red(`    Ejecuta 'pnpm db:doctor' para diagnosticar.`));
      return;
    }

    let created = 0;
    let skipped = 0;

    for (const room of roomsJson) {
      let roomId;
      let txHash;
      try {
        const nextRoomId = await publicClient.readContract({
          address: ROOM_BOOKING_ADDRESS,
          abi: ROOM_BOOKING_ABI,
          functionName: "nextRoomId",
        });
        roomId = Number(nextRoomId);

        txHash = await adminWalletClient.writeContract({
          address: ROOM_BOOKING_ADDRESS,
          abi: ROOM_BOOKING_ABI,
          functionName: "addRoom",
          args: [BigInt(room.capacity)],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        if (receipt.status !== "success") {
          skipped += 1;
          log(yellow(`  ⚠ No creada on-chain (tx revertida): ${room.name}`));
          continue;
        }
      } catch {
        skipped += 1;
        log(yellow(`  ⚠ No creada on-chain (nodo no disponible): ${room.name}`));
        continue;
      }

      await prisma.room.create({
        data: {
          roomId,
          name: room.name,
          description: room.description || null,
          location: room.location || null,
          capacity: room.capacity,
          amenities: room.amenities || undefined,
          txHash,
          active: true,
        },
      });

      created += 1;
      log(green(`  + #${roomId} ${room.name} (${room.capacity} personas)`));
    }

    log(green(`Sync completado. Creadas: ${created}, no creadas on-chain: ${skipped}`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
