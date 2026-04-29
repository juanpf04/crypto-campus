/**
 * seed-printers.mjs — Carga las impresoras por defecto.
 *
 * Idempotente: hace upsert por id, sin borrar nada.
 * Las impresoras son solo Prisma (no tienen registro on-chain).
 *
 * Uso: node scripts/seed-printers.mjs
 */

import prismaClientPkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const { PrismaClient } = prismaClientPkg;

const __dirname = dirname(fileURLToPath(import.meta.url));

const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

function log(msg) {
  console.log(`${cyan("[seed-printers]")} ${msg}`);
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

async function main() {
  const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const printersJson = JSON.parse(
      readFileSync(resolve(__dirname, "../prisma/seed-printers.json"), "utf-8")
    );

    // Idempotencia global: si ya hay tantas impresoras como esperamos, salir limpio.
    const expected = printersJson.length;
    const actual = await prisma.printer.count();
    if (actual >= expected) {
      log(green(`Ya sincronizado (${expected} impresoras). Saltando.`));
      return;
    }

    log(`Sincronizando ${expected} impresora(s)...`);

    let created = 0;
    let existing = 0;
    for (const printer of printersJson) {
      const existed = await prisma.printer.findUnique({ where: { id: printer.id } });
      const data = {
        location: printer.location,
        active: true,
      };

      await prisma.printer.upsert({
        where: { id: printer.id },
        update: data,
        create: { id: printer.id, ...data },
      });
      if (existed) existing++;
      else created++;
    }

    log(green(`Impresoras: ${created} nueva(s) · ${existing} ya existente(s)`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
