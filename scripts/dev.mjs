/**
 * Script para iniciar todo el entorno de desarrollo:
 * 1. Levanta PostgreSQL con Docker Compose
 * 2. Arranca el nodo de Hardhat
 * 3. Despliega los contratos del campus
 * 4. Ejecuta tareas de sincronizacion/mantenimiento
 * 5. Arranca Next.js
 *
 * Uso: node scripts/dev.mjs
 */

import { spawn } from "child_process";
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const HARDHAT_DIR = resolve(ROOT, "packages/hardhat");
const NEXTJS_DIR = resolve(ROOT, "packages/nextjs");

// Colores para la consola
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

function log(msg) {
  console.log(`${cyan("[dev]")} ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function run(command, args, { cwd, prefix = "[cmd]", allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      const msg = data.toString();
      stdout += msg;
      const trimmed = msg.trim();
      if (trimmed) console.log(`${cyan(prefix)} ${trimmed}`);
    });

    child.stderr.on("data", (data) => {
      const msg = data.toString();
      stderr += msg;
      const trimmed = msg.trim();
      if (trimmed) console.log(`${yellow(prefix)} ${trimmed}`);
    });

    child.on("close", (code) => {
      if (code === 0 || allowFailure) {
        resolve({ code, stdout, stderr });
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} falló con código ${code}`));
    });
  });
}

async function ensureDatabase() {
  log("Levantando PostgreSQL con Docker Compose...");
  try {
    await run("docker", ["compose", "up", "-d", "db"], {
      cwd: ROOT,
      prefix: "[db]",
    });
    log(green("Base de datos lista en localhost:5435"));
  } catch {
    console.error(
      red(
        "No se pudo iniciar la base de datos. Asegura que Docker Desktop este iniciado y vuelve a ejecutar 'pnpm dev'."
      )
    );
    process.exit(1);
  }
}

function runNodeScript(scriptName, { prefix, allowFailure = false, nonCriticalMessage } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptName], {
      cwd: NEXTJS_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    child.stdout.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg) console.log(msg);
    });

    child.stderr.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg) console.log(`${yellow(prefix)} ${msg}`);
    });

    child.on("close", (code) => {
      if (code === 0 || allowFailure) {
        if (code !== 0 && nonCriticalMessage) log(yellow(nonCriticalMessage));
        resolve();
        return;
      }
      reject(new Error(`${scriptName} falló con código ${code}`));
    });
  });
}

await ensureDatabase();

// 1. Arrancar el nodo de Hardhat
log("Arrancando nodo de Hardhat...");
const hardhatNode = spawn("npx", ["hardhat", "node"], {
  cwd: HARDHAT_DIR,
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
});

hardhatNode.stderr.on("data", (data) => {
  const msg = data.toString().trim();
  if (msg) console.log(`${yellow("[hardhat]")} ${msg}`);
});

// Esperar a que el nodo esté listo
await new Promise((resolve, reject) => {
  let ready = false;

  hardhatNode.stdout.on("data", (data) => {
    const msg = data.toString();
    if (!ready && msg.includes("Started HTTP")) {
      ready = true;
      log(green("Nodo de Hardhat listo en http://127.0.0.1:8545"));
      resolve();
    }
  });

  hardhatNode.on("close", (code) => {
    if (!ready) reject(new Error(`Hardhat node terminó antes de estar listo (código ${code})`));
  });
});

// Pequeña pausa para asegurar estabilidad
await sleep(1000);

// 2. Limpiar deployments anteriores para evitar conflictos
const deploymentsDir = resolve(HARDHAT_DIR, "ignition/deployments");
if (existsSync(deploymentsDir)) {
  log("Limpiando deployments anteriores...");
  const { rmSync } = await import("fs");
  rmSync(deploymentsDir, { recursive: true, force: true });
}

// 3. Desplegar los contratos del campus
log("Desplegando contratos CampusModule...");
const deployOutput = await new Promise((resolve, reject) => {
  let output = "";
  const deploy = spawn(
    "npx",
    ["hardhat", "ignition", "deploy", "ignition/modules/CampusModule.ts", "--network", "localhost"],
    {
      cwd: HARDHAT_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    }
  );

  deploy.stdout.on("data", (data) => {
    output += data.toString();
  });

  deploy.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`${yellow("[deploy]")} ${msg}`);
  });

  deploy.on("close", (code) => {
    if (code === 0) resolve(output);
    else reject(new Error(`Deploy falló con código ${code}\n${output}`));
  });
});

// 4. Extraer las direcciones de los contratos
// Buscar en el directorio de deployments generado por Ignition
let contractAddresses = {};

const deploymentsDirs = resolve(HARDHAT_DIR, "ignition/deployments");
if (existsSync(deploymentsDirs)) {
  const chains = readdirSync(deploymentsDirs);
  for (const chain of chains) {
    const addressFile = resolve(deploymentsDirs, chain, "deployed_addresses.json");
    if (existsSync(addressFile)) {
      contractAddresses = JSON.parse(readFileSync(addressFile, "utf-8"));
    }
  }
}

if (Object.keys(contractAddresses).length === 0) {
  console.error(red("No se pudieron obtener las direcciones de los contratos."));
  console.log(deployOutput);
  hardhatNode.kill();
  process.exit(1);
}

log(green(`Contratos desplegados:`));
for (const [key, addr] of Object.entries(contractAddresses)) {
  const name = key.split("#")[1] || key;
  console.log(`  ${cyan(name)}: ${addr}`);
}

// 6. Resincronizar usuarios de Prisma con la blockchain
log("Resincronizando usuarios existentes con la blockchain...");
await runNodeScript("scripts/resync-users.mjs", {
  prefix: "[resync]",
  allowFailure: true,
  nonCriticalMessage: "Resync terminó con errores (no crítico, continuando...)",
});

// 7. Seed del admin por defecto (idempotente — si ya existe, no hace nada)
log("Ejecutando seed del admin...");
await runNodeScript("scripts/seed-admin.mjs", {
  prefix: "[seed]",
  allowFailure: true,
  nonCriticalMessage: "Seed terminó con errores (no crítico, continuando...)",
});

// 8. Limpiar archivos de impresión expirados (>24h)
log("Limpiando archivos de impresión expirados...");
await runNodeScript("scripts/cleanup-uploads.mjs", {
  prefix: "[cleanup]",
  allowFailure: true,
  nonCriticalMessage: "Cleanup terminó con errores (no crítico, continuando...)",
});

// 9. Arrancar Next.js
log("Arrancando Next.js...");
const nextDev = spawn("npx", ["next", "dev"], {
  cwd: NEXTJS_DIR,
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
});

nextDev.stdout.on("data", (data) => {
  const msg = data.toString().trim();
  if (msg) console.log(`${green("[next]")} ${msg}`);
});

nextDev.stderr.on("data", (data) => {
  const msg = data.toString().trim();
  if (msg) console.log(`${green("[next]")} ${msg}`);
});

// Manejar cierre limpio
function cleanup() {
  log("Cerrando procesos...");
  hardhatNode.kill();
  nextDev.kill();
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Mantener el proceso vivo
await new Promise(() => {});
