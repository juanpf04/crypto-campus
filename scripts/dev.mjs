/**
 * Script para iniciar todo el entorno de desarrollo:
 * 1. Arranca el nodo de Hardhat
 * 2. Despliega el contrato Counter
 * 3. Escribe la dirección en .env.local del frontend
 * 4. Arranca Next.js
 *
 * Uso: node scripts/dev.mjs
 */

import { spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const HARDHAT_DIR = resolve(ROOT, "packages/hardhat");
const NEXTJS_DIR = resolve(ROOT, "packages/nextjs");
const ENV_FILE = resolve(NEXTJS_DIR, ".env.local");

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
await new Promise((resolve) => {
  hardhatNode.stdout.on("data", (data) => {
    const msg = data.toString();
    if (msg.includes("Started HTTP")) {
      log(green("Nodo de Hardhat listo en http://127.0.0.1:8545"));
      resolve();
    }
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
await new Promise((resolve, reject) => {
  const resync = spawn("node", ["scripts/resync-users.mjs"], {
    cwd: NEXTJS_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  resync.stdout.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(msg);
  });

  resync.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`${yellow("[resync]")} ${msg}`);
  });

  resync.on("close", (code) => {
    if (code === 0) resolve();
    else {
      log(yellow("Resync terminó con errores (no crítico, continuando...)"));
      resolve(); // No bloqueamos el arranque
    }
  });
});

// 7. Seed del admin por defecto (idempotente — si ya existe, no hace nada)
log("Ejecutando seed del admin...");
await new Promise((resolve) => {
  const seed = spawn("node", ["scripts/seed-admin.mjs"], {
    cwd: NEXTJS_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  seed.stdout.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(msg);
  });

  seed.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`${yellow("[seed]")} ${msg}`);
  });

  seed.on("close", (code) => {
    if (code !== 0) log(yellow("Seed terminó con errores (no crítico, continuando...)"));
    resolve();
  });
});

// 8. Limpiar archivos de impresión expirados (>24h)
log("Limpiando archivos de impresión expirados...");
await new Promise((resolve) => {
  const cleanup = spawn("node", ["scripts/cleanup-uploads.mjs"], {
    cwd: NEXTJS_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  cleanup.stdout.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(msg);
  });

  cleanup.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`${yellow("[cleanup]")} ${msg}`);
  });

  cleanup.on("close", () => resolve());
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
