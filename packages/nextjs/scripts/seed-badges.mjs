/**
 * seed-badges.mjs — Crea SubjectBadge, Assignments con PrizeCategories y Rewards
 * para todas las asignaturas seedeadas en seed-academic.
 *
 * Idempotente: si ya hay assignments para una asignatura, salta.
 * Crea variedad de estados (OPEN, REVIEWING, CLOSED) y entregas/awards.
 *
 * Uso: node scripts/seed-badges.mjs
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

function log(msg) { console.log(`${cyan("[seed-badges]")} ${msg}`); }

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

const HARDHAT_DIR = resolve(__dirname, "../../hardhat");
const artifactsDir = resolve(HARDHAT_DIR, "artifacts/contracts");

function loadAbi(name) {
  return JSON.parse(readFileSync(resolve(artifactsDir, `${name}.sol/${name}.json`), "utf-8")).abi;
}

const BADGE_SYSTEM_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const BADGE_SYSTEM_ABI = loadAbi("BadgeSystem");

const publicClient = createPublicClient({ chain: hardhat, transport: http("http://127.0.0.1:8545") });
const ADMIN_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const adminAccount = privateKeyToAccount(ADMIN_PRIVATE_KEY);
const adminWalletClient = createWalletClient({
  account: adminAccount, chain: hardhat, transport: http("http://127.0.0.1:8545"),
});

async function txWait(hash) {
  const r = await publicClient.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error("tx revertida");
  return r;
}

// ── Plantillas de tareas por tipo de asignatura ─────────────────────────
const ASSIGNMENT_TEMPLATES = [
  {
    name: "Práctica 1 — Proyecto inicial",
    description: "Primera entrega del cuatrimestre. Implementa los requisitos básicos.",
    prizes: [
      { name: "Mejor nota", description: "El alumno con la nota más alta", badgeReward: 10, maxWinners: 3 },
      { name: "Mejor diseño", description: "Diseño visual más cuidado", badgeReward: 8, maxWinners: 2 },
      { name: "Más original", description: "Solución más creativa", badgeReward: 6, maxWinners: 1 },
    ],
  },
  {
    name: "Práctica 2 — Funcionalidad avanzada",
    description: "Amplía el proyecto con funcionalidades avanzadas.",
    prizes: [
      { name: "Mejor nota", description: "", badgeReward: 12, maxWinners: 3 },
      { name: "Más útil", description: "La funcionalidad más práctica", badgeReward: 7, maxWinners: 2 },
    ],
  },
  {
    name: "Trabajo final",
    description: "Proyecto integrador del curso.",
    prizes: [
      { name: "Mejor entrega", description: "Calidad global", badgeReward: 15, maxWinners: 5 },
      { name: "Más accesible", description: "Cumplimiento WCAG", badgeReward: 8, maxWinners: 2 },
    ],
  },
];

const REWARD_TEMPLATES = [
  { name: "Punto extra en examen", description: "+0,5 puntos al examen final", badgeCost: 15, supply: 10 },
  { name: "Subir nota práctica", description: "+1 punto en cualquier práctica", badgeCost: 10, supply: 0 },
];

// ── Crear SubjectBadge si no existe ─────────────────────────────────────
async function ensureSubjectBadge(prisma, offeringId) {
  const existing = await prisma.subjectBadge.findUnique({ where: { subjectOfferingId: offeringId } });
  if (existing) return existing;

  const nextId = await publicClient.readContract({
    address: BADGE_SYSTEM_ADDRESS, abi: BADGE_SYSTEM_ABI, functionName: "nextSubjectBadgeId",
  });
  const tokenId = Number(nextId);

  const hash = await adminWalletClient.writeContract({
    address: BADGE_SYSTEM_ADDRESS, abi: BADGE_SYSTEM_ABI, functionName: "createSubjectBadge",
  });
  await txWait(hash);

  return prisma.subjectBadge.create({ data: { tokenId, subjectOfferingId: offeringId, txHash: hash } });
}

// ── Crear assignment + premios ──────────────────────────────────────────
async function createAssignmentWithPrizes(prisma, badge, creatorId, template) {
  const nextAssignmentId = await publicClient.readContract({
    address: BADGE_SYSTEM_ADDRESS, abi: BADGE_SYSTEM_ABI, functionName: "nextAssignmentId",
  });
  const assignmentChainId = Number(nextAssignmentId);

  const hash = await adminWalletClient.writeContract({
    address: BADGE_SYSTEM_ADDRESS, abi: BADGE_SYSTEM_ABI, functionName: "createAssignment",
    args: [BigInt(badge.tokenId)],
  });
  await txWait(hash);

  const prizeChainIds = [];
  const prizeTxHashes = [];
  for (const prize of template.prizes) {
    const nextPrizeId = await publicClient.readContract({
      address: BADGE_SYSTEM_ADDRESS, abi: BADGE_SYSTEM_ABI, functionName: "nextPrizeCategoryId",
    });
    prizeChainIds.push(Number(nextPrizeId));
    const ph = await adminWalletClient.writeContract({
      address: BADGE_SYSTEM_ADDRESS, abi: BADGE_SYSTEM_ABI, functionName: "addPrizeCategory",
      args: [BigInt(assignmentChainId), BigInt(prize.badgeReward), BigInt(prize.maxWinners)],
    });
    await txWait(ph);
    prizeTxHashes.push(ph);
  }

  return prisma.assignment.create({
    data: {
      assignmentId: assignmentChainId,
      name: template.name,
      description: template.description,
      subjectBadgeId: badge.id,
      creatorId,
      txHash: hash,
      prizes: {
        create: template.prizes.map((p, i) => ({
          prizeCategoryId: prizeChainIds[i],
          name: p.name,
          description: p.description || null,
          badgeReward: p.badgeReward,
          maxWinners: p.maxWinners,
          txHash: prizeTxHashes[i],
        })),
      },
    },
    include: { prizes: true },
  });
}

// ── Crear reward ────────────────────────────────────────────────────────
async function createReward(prisma, badge, creatorId, template) {
  const nextRewardId = await publicClient.readContract({
    address: BADGE_SYSTEM_ADDRESS, abi: BADGE_SYSTEM_ABI, functionName: "nextRewardId",
  });
  const rewardChainId = Number(nextRewardId);

  const hash = await adminWalletClient.writeContract({
    address: BADGE_SYSTEM_ADDRESS, abi: BADGE_SYSTEM_ABI, functionName: "createReward",
    args: [BigInt(badge.tokenId), BigInt(template.badgeCost), BigInt(template.supply)],
  });
  await txWait(hash);

  return prisma.reward.create({
    data: {
      rewardId: rewardChainId,
      name: template.name,
      description: template.description,
      subjectBadgeId: badge.id,
      badgeCost: template.badgeCost,
      supply: template.supply,
      creatorId,
      txHash: hash,
    },
  });
}

// ── Otorgar premio ──────────────────────────────────────────────────────
async function awardPrizeToStudents(prisma, assignment, prize, students, awardedById) {
  if (students.length === 0) return;
  const hash = await adminWalletClient.writeContract({
    address: BADGE_SYSTEM_ADDRESS, abi: BADGE_SYSTEM_ABI, functionName: "awardPrize",
    args: [BigInt(prize.prizeCategoryId), students.map(s => s.address)],
  });
  await txWait(hash);

  await prisma.badgeAward.createMany({
    data: students.map(s => ({
      userId: s.id,
      prizeCategoryId: prize.id,
      subjectBadgeId: assignment.subjectBadgeId,
      awardedById,
      txHash: hash,
    })),
  });
}

// ── Cambiar estado de assignment on-chain + Prisma ──────────────────────
async function setAssignmentStatus(prisma, assignment, target) {
  const fnName = target === "REVIEWING" ? "closeAssignmentForReview" : "closeAssignment";
  const hash = await adminWalletClient.writeContract({
    address: BADGE_SYSTEM_ADDRESS, abi: BADGE_SYSTEM_ABI, functionName: fnName,
    args: [BigInt(assignment.assignmentId)],
  });
  await txWait(hash);
  await prisma.assignment.update({
    where: { id: assignment.id },
    data: target === "CLOSED"
      ? { status: "CLOSED", closedAt: new Date() }
      : { status: "REVIEWING" },
  });
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const offerings = await prisma.subjectOffering.findMany({
      include: {
        subject: true,
        professor: { select: { id: true, address: true, name: true } },
        enrollments: { include: { user: { select: { id: true, address: true, name: true } } } },
      },
    });

    if (offerings.length === 0) {
      log(yellow("No hay subjectOfferings. Ejecuta seed-academic antes."));
      return;
    }

    let createdAssignments = 0;
    let createdRewards = 0;
    let createdAwards = 0;

    for (const offering of offerings) {
      // Saltar si ya hay assignments para este offering
      const badge = await prisma.subjectBadge.findUnique({ where: { subjectOfferingId: offering.id } });
      if (badge) {
        const existing = await prisma.assignment.count({ where: { subjectBadgeId: badge.id } });
        if (existing > 0) {
          log(yellow(`  ⤷ ${offering.subject.code} ${offering.group}: ya tiene ${existing} tareas. Saltando.`));
          continue;
        }
      }

      log(green(`Creando datos para ${offering.subject.code} ${offering.group} (${offering.professor.name})...`));

      const subjectBadge = await ensureSubjectBadge(prisma, offering.id);
      const students = offering.enrollments.map(e => e.user);
      const creatorId = offering.professor.id;

      // Decidimos qué hacer con cada plantilla:
      //   - Plantilla 0: CLOSED con premios otorgados.
      //   - Plantilla 1: REVIEWING con algunas entregas.
      //   - Plantilla 2: OPEN sin entregas.
      const planTemplates = [
        { template: ASSIGNMENT_TEMPLATES[0], finalStatus: "CLOSED",    submitFraction: 0.8, awardPrizes: true  },
        { template: ASSIGNMENT_TEMPLATES[1], finalStatus: "REVIEWING", submitFraction: 0.5, awardPrizes: false },
        { template: ASSIGNMENT_TEMPLATES[2], finalStatus: "OPEN",      submitFraction: 0,   awardPrizes: false },
      ];

      for (const plan of planTemplates) {
        const assignment = await createAssignmentWithPrizes(prisma, subjectBadge, creatorId, plan.template);
        createdAssignments++;
        log(`  + Tarea: ${plan.template.name}`);

        // Crear submissions aleatorias
        const numSubmits = Math.floor(students.length * plan.submitFraction);
        const shuffled = [...students].sort(() => Math.random() - 0.5);
        const submitters = shuffled.slice(0, numSubmits);
        if (submitters.length > 0) {
          await prisma.taskSubmission.createMany({
            data: submitters.map(s => ({ assignmentId: assignment.id, studentId: s.id })),
          });
          log(`    ⤷ ${submitters.length} entregas`);
        }

        // Otorgar premios si corresponde (solo para la plantilla 0)
        if (plan.awardPrizes) {
          for (const prize of assignment.prizes) {
            // Elegir N ganadores entre los submitters
            const numWinners = Math.min(prize.maxWinners, submitters.length);
            const winners = submitters.slice(0, numWinners);
            if (winners.length > 0) {
              await awardPrizeToStudents(prisma, assignment, prize, winners, creatorId);
              createdAwards += winners.length;
              log(`    ⤷ Premio "${prize.name}" otorgado a ${winners.length} alumno(s)`);
            }
          }
        }

        // Aplicar cambio de estado
        if (plan.finalStatus === "REVIEWING") {
          await setAssignmentStatus(prisma, assignment, "REVIEWING");
        } else if (plan.finalStatus === "CLOSED") {
          await setAssignmentStatus(prisma, assignment, "REVIEWING");
          await setAssignmentStatus(prisma, assignment, "CLOSED");
        }
      }

      // Crear rewards
      for (const rt of REWARD_TEMPLATES) {
        await createReward(prisma, subjectBadge, creatorId, rt);
        createdRewards++;
      }
      log(`  + ${REWARD_TEMPLATES.length} recompensas creadas`);
    }

    log(green(`Seed badges completado: ${createdAssignments} tareas, ${createdRewards} recompensas, ${createdAwards} premios.`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
