/**
 * seed-academic.mjs — Crea profesores, estudiantes, asignaturas, ofertas y matrículas.
 *
 * Idempotente: comprueba existencia por email antes de crear usuarios.
 * Asignaturas, ofertas y matrículas usan upsert.
 *
 * Uso: node scripts/seed-academic.mjs
 */

import { createPublicClient, createWalletClient, http, parseEther, keccak256, toBytes } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import prismaClientPkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createCipheriv, randomBytes } from "crypto";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const { PrismaClient } = prismaClientPkg;

const __dirname = dirname(fileURLToPath(import.meta.url));

const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

function log(msg) {
  console.log(`${cyan("[seed-academic]")} ${msg}`);
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
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
          val = val.slice(1, -1);
        vars[key] = val;
      }
    } catch { /* no existe */ }
  }
  return vars;
}

const env = loadEnv();
const SESSION_SECRET = env.SESSION_SECRET || process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  log(yellow("No se encontró SESSION_SECRET. Saltando."));
  process.exit(0);
}

function encrypt(text) {
  const KEY = Buffer.from(SESSION_SECRET.padEnd(32, "0").slice(0, 32));
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

// ABIs y direcciones
const HARDHAT_DIR = resolve(__dirname, "../../hardhat");
const artifactsDir = resolve(HARDHAT_DIR, "artifacts/contracts");

function loadAbi(name) {
  return JSON.parse(readFileSync(resolve(artifactsDir, `${name}.sol/${name}.json`), "utf-8")).abi;
}

const ADDRESSES = {
  campusRoles: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  libraryToken: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  shopToken: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
  badgeSystem: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
};

const CAMPUS_ABI = loadAbi("CampusRoles");
const LIBRARY_TOKEN_ABI = loadAbi("LibraryToken");
const SHOP_TOKEN_ABI = loadAbi("ShopToken");
const BADGE_SYSTEM_ABI = loadAbi("BadgeSystem");

// ── Plantillas de recompensas por categoría ─────────────────────────────────
// Una por categoría para ver los distintos iconos. badgeCost y supply razonables.
const REWARD_TEMPLATES = [
  {
    category: "TIEMPO",
    name: "24h adicionales para entregar práctica",
    description: "Extiende el plazo de entrega de una práctica 24 horas sin penalización.",
    badgeCost: 5,
    supply: 0, // ilimitado
  },
  {
    category: "EXAMEN",
    name: "Saltar una pregunta en el examen",
    description: "Permite omitir una pregunta en el examen final y recibir la puntuación media de la clase.",
    badgeCost: 10,
    supply: 10,
  },
  {
    category: "PRACTICA",
    name: "+0,5 puntos en una práctica",
    description: "Suma medio punto a la nota de una práctica a elección del alumno.",
    badgeCost: 8,
    supply: 15,
  },
  {
    category: "CONSULTA",
    name: "Tutoría individual de 30 minutos",
    description: "Reserva media hora de tutoría personalizada con el profesor fuera del horario oficial.",
    badgeCost: 6,
    supply: 0, // ilimitado
  },
  {
    category: "OTROS",
    name: "Mención en la web del grupo",
    description: "Se te menciona como estudiante destacado en la página del grupo durante el semestre.",
    badgeCost: 12,
    supply: 3,
  },
];

const ROLE_HASHES = {
  PROFESSOR: keccak256(toBytes("PROFESSOR_ROLE")),
  STUDENT: keccak256(toBytes("STUDENT_ROLE")),
};

const publicClient = createPublicClient({ chain: hardhat, transport: http("http://127.0.0.1:8545") });
const ADMIN_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const adminAccount = privateKeyToAccount(ADMIN_PRIVATE_KEY);
const adminWalletClient = createWalletClient({ account: adminAccount, chain: hardhat, transport: http("http://127.0.0.1:8545") });

const DEFAULT_PASSWORD = "Admin^12";

/**
 * Asegura que existe un SubjectBadge on-chain para esa SubjectOffering y lo
 * persiste en Prisma. Idempotente: si ya existe, lo devuelve directamente.
 */
async function ensureSubjectBadge(prisma, offeringId) {
  const existing = await prisma.subjectBadge.findUnique({
    where: { subjectOfferingId: offeringId },
  });
  if (existing) return existing;

  const nextId = await publicClient.readContract({
    address: ADDRESSES.badgeSystem,
    abi: BADGE_SYSTEM_ABI,
    functionName: "nextSubjectBadgeId",
  });
  const tokenId = Number(nextId);

  const hash = await adminWalletClient.writeContract({
    address: ADDRESSES.badgeSystem,
    abi: BADGE_SYSTEM_ABI,
    functionName: "createSubjectBadge",
    args: [],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  return prisma.subjectBadge.create({
    data: { tokenId, subjectOfferingId: offeringId, txHash: hash },
  });
}

/**
 * Crea una reward on-chain + Prisma para un SubjectBadge concreto.
 */
async function createSeedReward(prisma, subjectBadge, professorId, template) {
  const nextId = await publicClient.readContract({
    address: ADDRESSES.badgeSystem,
    abi: BADGE_SYSTEM_ABI,
    functionName: "nextRewardId",
  });
  const rewardId = Number(nextId);

  const hash = await adminWalletClient.writeContract({
    address: ADDRESSES.badgeSystem,
    abi: BADGE_SYSTEM_ABI,
    functionName: "createReward",
    args: [BigInt(subjectBadge.tokenId), BigInt(template.badgeCost), BigInt(template.supply)],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  return prisma.reward.create({
    data: {
      rewardId,
      name: template.name,
      description: template.description,
      subjectBadgeId: subjectBadge.id,
      badgeCost: template.badgeCost,
      supply: template.supply,
      category: template.category,
      creatorId: professorId,
      txHash: hash,
    },
  });
}

async function createUser(prisma, { email, name, role }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    log(`  ✓ ${email} ya existe. Saltando.`);
    return existing;
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const encryptedKey = encrypt(privateKey);

  // Fondear wallet
  const fundHash = await adminWalletClient.sendTransaction({ to: account.address, value: parseEther("10") });
  await publicClient.waitForTransactionReceipt({ hash: fundHash });

  // Registrar on-chain
  const regHash = await adminWalletClient.writeContract({
    address: ADDRESSES.campusRoles, abi: CAMPUS_ABI, functionName: "registerUser",
    args: [account.address, name, ROLE_HASHES[role]],
  });
  await publicClient.waitForTransactionReceipt({ hash: regHash });

  // Mintear LibraryTokens iniciales (depósito para préstamos)
  const libHash = await adminWalletClient.writeContract({
    address: ADDRESSES.libraryToken, abi: LIBRARY_TOKEN_ABI, functionName: "mint",
    args: [account.address, 10n],
  });
  await publicClient.waitForTransactionReceipt({ hash: libHash });

  // No minteamos ShopTokens al crear usuarios: se ganan usando la app
  // (sistema de recompensas en ShopTokenReward). Empiezan con balance 0.
  // El contrato ShopToken revierte con ZeroAmount() si intentas mint(0),
  // así que simplemente no llamamos al contrato.

  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name, role, address: account.address, encryptedKey },
  });

  log(green(`  + ${email} (${role})`));
  return user;
}

async function main() {
  const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const data = JSON.parse(readFileSync(resolve(__dirname, "../prisma/seed-academic.json"), "utf-8"));

    // 1. Crear profesores
    log("Creando profesores...");
    const professorMap = {};
    for (const prof of data.professors) {
      const user = await createUser(prisma, { ...prof, role: "PROFESSOR" });
      professorMap[prof.email] = user.id;
    }

    // 2. Crear estudiantes
    log("Creando estudiantes...");
    const studentMap = {};
    for (const stu of data.students) {
      const user = await createUser(prisma, { ...stu, role: "STUDENT" });
      studentMap[stu.email] = user.id;
    }

    // 3. Crear asignaturas
    log("Creando asignaturas...");
    const subjectMap = {};
    for (const subj of data.subjects) {
      const subject = await prisma.subject.upsert({
        where: { code: subj.code },
        update: { name: subj.name },
        create: { code: subj.code, name: subj.name },
      });
      subjectMap[subj.code] = subject.id;
      log(green(`  + ${subj.code} — ${subj.name}`));
    }

    // 4. Crear ofertas
    log("Creando ofertas...");
    const offeringMap = {};
    for (const off of data.offerings) {
      const subjectId = subjectMap[off.subjectCode];
      const professorId = professorMap[off.professorEmail];
      if (!subjectId || !professorId) {
        log(yellow(`  ⚠ Oferta no creada: ${off.subjectCode} ${off.group} (falta subject o professor)`));
        continue;
      }

      const offering = await prisma.subjectOffering.upsert({
        where: {
          subjectId_professorId_group_academicYear: {
            subjectId, professorId, group: off.group, academicYear: off.academicYear,
          },
        },
        update: {},
        create: { subjectId, professorId, group: off.group, academicYear: off.academicYear },
      });
      offeringMap[`${off.subjectCode}-${off.group}`] = offering.id;
      log(green(`  + ${off.subjectCode} ${off.group} (${off.academicYear})`));
    }

    // 5. Crear matrículas
    log("Creando matrículas...");
    let enrollCount = 0;
    for (const enr of data.enrollments) {
      const userId = studentMap[enr.studentEmail];
      const offeringId = offeringMap[`${enr.subjectCode}-${enr.group}`];
      if (!userId || !offeringId) continue;

      await prisma.enrollment.upsert({
        where: { userId_subjectOfferingId: { userId, subjectOfferingId: offeringId } },
        update: {},
        create: { userId, subjectOfferingId: offeringId },
      });
      enrollCount++;
    }
    log(green(`  + ${enrollCount} matrícula(s) creadas`));

    // 6. Crear SubjectBadge (on-chain) + recompensas demo por cada oferta
    log("Creando SubjectBadges y recompensas demo...");
    let badgesCreated = 0;
    let rewardsCreated = 0;
    for (const off of data.offerings) {
      const offeringId = offeringMap[`${off.subjectCode}-${off.group}`];
      const professorId = professorMap[off.professorEmail];
      if (!offeringId || !professorId) continue;

      const subjectBadgeBefore = await prisma.subjectBadge.findUnique({
        where: { subjectOfferingId: offeringId },
      });
      const subjectBadge = await ensureSubjectBadge(prisma, offeringId);
      if (!subjectBadgeBefore) badgesCreated++;

      const existingRewards = await prisma.reward.count({
        where: { subjectBadgeId: subjectBadge.id },
      });
      if (existingRewards > 0) continue;

      for (const tpl of REWARD_TEMPLATES) {
        await createSeedReward(prisma, subjectBadge, professorId, tpl);
        rewardsCreated++;
      }
    }
    log(green(`  + ${badgesCreated} SubjectBadge(s) creados on-chain · ${rewardsCreated} recompensa(s) creadas`));

    log(green("Seed académico completado."));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
