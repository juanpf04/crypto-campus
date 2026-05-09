/**
 * seed-historical.mjs — Genera datos históricos (3-12 meses atrás) en Prisma.
 *
 * Estos datos NO tocan blockchain en absoluto. Sirven para que las gráficas y
 * dashboards (top productos, préstamos por mes, créditos consumidos, etc.) se
 * vean bien en demos sin tener que ejecutar miles de transacciones on-chain.
 *
 * Todos los registros generados llevan `historical: true` y los IDs on-chain
 * (`loanId`, `bookingId`, `orderId`, `batchId`) van a `null`. También `txHash`
 * va a `null` donde el campo es opcional.
 *
 * Modelos generados (por estudiante activo):
 *   - Loan         × 10  (status RETURNED)
 *   - RoomBooking  × 6   (cancelled false, fecha pasada, una por usuario+día)
 *   - PrintLog     × 20
 *   - OrderBatch   × 4   (status DELIVERED) con 1-4 Orders cada uno
 *
 * IMPORTANTE: NO se crean registros en `ShopTokenReward`. La lógica de
 * "primer uso de módulo" depende de que no existan rewards previos: si los
 * sembráramos, romperíamos el bonus del primer uso real en producción.
 *
 * Idempotencia: cuenta lo existente con historical=true por modelo. Si ya
 * hay ≥ target, salta el bloque. Si hay menos, genera solo la diferencia.
 *
 * Uso: node scripts/seed-historical.mjs
 */

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
  console.log(`${cyan("[seed-historical]")} ${msg}`);
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

// ── Targets por estudiante ──
const LOANS_PER_STUDENT = 10;
const BOOKINGS_PER_STUDENT = 6;
const PRINTS_PER_STUDENT = 20;
const ORDER_BATCHES_PER_STUDENT = 4;

// ── Helpers de aleatoriedad ──
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Distribución Pareto: devuelve un elemento del array con probabilidad sesgada
 * a los primeros índices. alpha=1.16 ≈ regla 80/20 clásica.
 *
 * Implementación: u ∈ (0, 1) → idx = floor(N * (1 - u^(1/alpha))).
 * Cuanto menor el alpha, mayor el sesgo a los populares.
 */
function pickPareto(arr, alpha = 1.16) {
  if (arr.length === 0) return undefined;
  const u = Math.random();
  let idx = Math.floor(arr.length * (1 - Math.pow(u, 1 / alpha)));
  if (idx < 0) idx = 0;
  if (idx >= arr.length) idx = arr.length - 1;
  return arr[idx];
}

/**
 * Devuelve N elementos distintos seleccionados via pickPareto.
 * Si el array tiene menos elementos que N, devuelve todos sin duplicar.
 */
function pickParetoMany(arr, n, alpha = 1.16) {
  const target = Math.min(n, arr.length);
  const out = [];
  const seen = new Set();
  // Cap de intentos por si Pareto devuelve siempre los mismos primeros índices.
  let attempts = 0;
  while (out.length < target && attempts < target * 20) {
    const item = pickPareto(arr, alpha);
    if (!seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
    attempts++;
  }
  // Fallback: completar aleatoriamente si no llegamos.
  if (out.length < target) {
    for (const item of arr) {
      if (out.length >= target) break;
      if (!seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
    }
  }
  return out;
}

// ── Helpers de fechas ──
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function addDaysRandom(date, minDays, maxDays) {
  return addDays(date, randInt(minDays, maxDays));
}

function setMidnight(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Devuelve una fecha aleatoria entre [monthsAgoMax meses atrás, monthsAgoMin
 * meses atrás] respecto a "ahora". Nunca devuelve fechas futuras.
 *
 * Ej: randomDateInRange(12, 1) → cualquier instante en el rango [12 meses
 * atrás, 1 mes atrás].
 */
function randomDateInRange(monthsAgoMax, monthsAgoMin) {
  const now = Date.now();
  const oldest = now - monthsAgoMax * 30 * MS_PER_DAY;
  const newest = now - monthsAgoMin * 30 * MS_PER_DAY;
  const t = oldest + Math.random() * (newest - oldest);
  return new Date(t);
}

// ── Helpers de impresión ──
const FILENAME_PREFIXES = [
  "trabajo", "apuntes_calculo", "examen_resuelto", "esquema_bd",
  "presentacion", "memoria_practica", "informe_lab", "guion_clase",
  "ejercicios_resueltos", "tema", "resumen_tema", "diapositivas",
  "anexo_proyecto", "tfg_borrador", "manual_lab",
];

function randomFilename() {
  const prefix = pickRandom(FILENAME_PREFIXES);
  const num = randInt(1, 50);
  return `${prefix}_${num}.pdf`;
}

/**
 * Páginas con distribución log-normal-ish: la mayoría son trabajos pequeños
 * (1-15 páginas) pero ocasionalmente hay documentos grandes (30-50 páginas).
 */
function randomPages() {
  const raw = Math.exp(2 + Math.random() * 1.5);
  return Math.max(1, Math.min(50, Math.round(raw)));
}

// ── Generadores por dominio ────────────────────────────────────────────────

async function seedHistoricalLoans(prisma, students, items, count) {
  if (count <= 0) {
    log(green("  Préstamos: ya hay suficientes históricos. Saltando."));
    return;
  }
  log(`  Generando ${count} préstamos históricos...`);
  const data = [];
  for (let i = 0; i < count; i++) {
    const student = pickRandom(students);
    const item = pickPareto(items);
    const requestDate = randomDateInRange(12, 1);
    const pickupDate = addDaysRandom(requestDate, 1, 3);
    const dueDate = addDays(pickupDate, 14);
    const returnDate = addDaysRandom(pickupDate, 5, 14);
    data.push({
      loanId: null,
      libraryItemId: item.id,
      userId: student.id,
      status: "RETURNED",
      requestTxHash: null,
      pickupTxHash: null,
      returnTxHash: null,
      requestDate,
      reservationDate: requestDate,
      pickupDate,
      dueDate,
      returnDate,
      overdue: returnDate > dueDate,
      historical: true,
    });
  }
  // Insertar en chunks para no exceder límites de parámetros del driver.
  const CHUNK = 500;
  for (let i = 0; i < data.length; i += CHUNK) {
    await prisma.loan.createMany({ data: data.slice(i, i + CHUNK) });
  }
  log(green(`  + ${data.length} préstamos históricos creados.`));
}

async function seedHistoricalBookings(prisma, students, rooms, count) {
  if (count <= 0) {
    log(green("  Reservas: ya hay suficientes históricas. Saltando."));
    return;
  }
  log(`  Generando ${count} reservas históricas...`);

  // Cargar las claves (userId|dateISO) ya existentes para no chocar con las
  // reservas reales actuales ni con las que vayamos creando ahora.
  const existing = await prisma.roomBooking.findMany({
    select: { userId: true, date: true },
  });
  const taken = new Set(existing.map((b) => `${b.userId}|${b.date.toISOString().slice(0, 10)}`));

  const data = [];
  let attempts = 0;
  while (data.length < count && attempts < count * 50) {
    attempts++;
    const student = pickRandom(students);
    const room = pickPareto(rooms);
    const date = setMidnight(randomDateInRange(12, 1));
    const key = `${student.id}|${date.toISOString().slice(0, 10)}`;
    if (taken.has(key)) continue;
    taken.add(key);
    data.push({
      bookingId: null,
      roomId: room.id,
      userId: student.id,
      date,
      startHour: randInt(8, 19),
      duration: randInt(1, 4),
      cancelled: false,
      txHash: null,
      historical: true,
    });
  }
  if (data.length < count) {
    log(yellow(`  ⚠ Solo se pudieron generar ${data.length}/${count} reservas únicas (colisión usuario-día).`));
  }
  const CHUNK = 500;
  for (let i = 0; i < data.length; i += CHUNK) {
    await prisma.roomBooking.createMany({ data: data.slice(i, i + CHUNK) });
  }
  log(green(`  + ${data.length} reservas históricas creadas.`));
}

async function seedHistoricalPrints(prisma, students, printers, count) {
  if (count <= 0) {
    log(green("  Impresiones: ya hay suficientes históricas. Saltando."));
    return;
  }
  log(`  Generando ${count} impresiones históricas...`);
  const data = [];
  for (let i = 0; i < count; i++) {
    const student = pickRandom(students);
    const printer = pickPareto(printers);
    const pages = randomPages();
    const copies = randInt(1, 3);
    const createdAt = randomDateInRange(12, 1);
    data.push({
      userId: student.id,
      filename: randomFilename(),
      pages,
      copies,
      printerId: printer.id,
      txHash: null,
      creditsUsed: pages * copies,
      creditsAfter: randInt(50, 200),
      color: Math.random() < 0.4,         // 60% B/N, 40% color
      duplex: Math.random() < 0.7,        // 70% dúplex
      orientation: "portrait",
      paperSize: "A4",
      pagesPerSheet: 1,
      filePages: pages,
      fileSize: randInt(50_000, 2_000_000),
      filePath: null,
      createdAt,
      historical: true,
    });
  }
  const CHUNK = 500;
  for (let i = 0; i < data.length; i += CHUNK) {
    await prisma.printLog.createMany({ data: data.slice(i, i + CHUNK) });
  }
  log(green(`  + ${data.length} impresiones históricas creadas.`));
}

async function seedHistoricalOrders(prisma, students, products, batchCount) {
  if (batchCount <= 0) {
    log(green("  Pedidos: ya hay suficientes históricos. Saltando."));
    return;
  }
  log(`  Generando ${batchCount} batches de pedidos históricos...`);

  let createdBatches = 0;
  let createdOrders = 0;

  for (let i = 0; i < batchCount; i++) {
    const student = pickRandom(students);
    const purchaseDate = randomDateInRange(12, 1);
    const numItems = randInt(1, 4);
    const picked = pickParetoMany(products, numItems);
    if (picked.length === 0) continue;

    const orderItems = picked.map((product) => {
      const quantity = randInt(1, 3);
      const pricePaid = product.price * quantity;
      const deliveryDate = addDaysRandom(purchaseDate, 1, 3);
      return {
        orderId: null,
        userId: student.id,
        productId: product.id,
        quantity,
        pricePaid,
        status: "DELIVERED",
        txHash: null,
        purchaseDate,
        deliveryDate,
        historical: true,
      };
    });

    const totalPaid = orderItems.reduce((s, o) => s + o.pricePaid, 0);

    // Nested write: crea el batch y todos sus orders en una sola tx implícita.
    // El campo de la relación inversa en OrderBatch se llama `items`.
    await prisma.orderBatch.create({
      data: {
        batchId: null,
        userId: student.id,
        totalPaid,
        txHash: null,
        purchaseDate,
        historical: true,
        items: { create: orderItems },
      },
    });

    createdBatches++;
    createdOrders += orderItems.length;
  }

  log(green(`  + ${createdBatches} batches con ${createdOrders} pedidos históricos creados.`));
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    log(red("  ✗ No hay DATABASE_URL. Aborting."));
    process.exit(1);
  }
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Cargar entidades base
    const [students, items, products, rooms, printers] = await Promise.all([
      prisma.user.findMany({ where: { role: "STUDENT", active: true } }),
      prisma.libraryItem.findMany({ where: { active: true } }),
      prisma.product.findMany({ where: { active: true } }),
      prisma.room.findMany({ where: { active: true } }),
      prisma.printer.findMany({ where: { active: true } }),
    ]);

    // 2. Validar pre-requisitos
    const missing = [];
    if (students.length === 0) missing.push("estudiantes (seed-academic.mjs)");
    if (items.length === 0) missing.push("ítems de biblioteca (seed-library.mjs)");
    if (products.length === 0) missing.push("productos (seed-products.mjs)");
    if (rooms.length === 0) missing.push("salas (seed-rooms.mjs)");
    if (printers.length === 0) missing.push("impresoras (seed-printers.mjs)");
    if (missing.length > 0) {
      log(red(`  ✗ Faltan datos base: ${missing.join(", ")}.`));
      log(red(`    Ejecuta los seeds previos antes que este.`));
      process.exit(1);
    }

    log(
      `Base: ${students.length} estudiantes · ${items.length} ítems · ` +
      `${products.length} productos · ${rooms.length} salas · ${printers.length} impresoras.`,
    );

    const targetLoans = students.length * LOANS_PER_STUDENT;
    const targetBookings = students.length * BOOKINGS_PER_STUDENT;
    const targetPrints = students.length * PRINTS_PER_STUDENT;
    const targetBatches = students.length * ORDER_BATCHES_PER_STUDENT;

    // 3. Counts existentes (solo históricos)
    const [existLoans, existBookings, existPrints, existBatches] = await Promise.all([
      prisma.loan.count({ where: { historical: true } }),
      prisma.roomBooking.count({ where: { historical: true } }),
      prisma.printLog.count({ where: { historical: true } }),
      prisma.orderBatch.count({ where: { historical: true } }),
    ]);

    log(
      `Históricos actuales: loans=${existLoans}/${targetLoans} · ` +
      `bookings=${existBookings}/${targetBookings} · ` +
      `prints=${existPrints}/${targetPrints} · ` +
      `orderBatches=${existBatches}/${targetBatches}.`,
    );

    // 4. Generar la diferencia (clamp a >= 0)
    await seedHistoricalLoans(prisma, students, items, Math.max(0, targetLoans - existLoans));
    await seedHistoricalBookings(prisma, students, rooms, Math.max(0, targetBookings - existBookings));
    await seedHistoricalPrints(prisma, students, printers, Math.max(0, targetPrints - existPrints));
    await seedHistoricalOrders(prisma, students, products, Math.max(0, targetBatches - existBatches));

    log(green("Seed histórico completado."));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
