/**
 * seed-rooms.mjs — Carga las salas de estudio por defecto.
 *
 * Idempotente: limpia y recrea salas en cada arranque (blockchain se reinicia).
 *
 * Pasos por cada sala del JSON:
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

    log(`Sincronizando ${roomsJson.length} sala(s)...`);

    // Limpiar reservas y salas anteriores
    const deletedBookings = await prisma.roomBooking.deleteMany({});
    const deletedRooms = await prisma.room.deleteMany({});
    if (deletedRooms.count > 0) {
      log(yellow(`  ⚠ Limpiadas ${deletedRooms.count} sala(s) y ${deletedBookings.count} reserva(s) huérfanas`));
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
