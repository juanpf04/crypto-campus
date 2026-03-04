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

// 3. Desplegar el contrato
log("Desplegando contrato Counter...");
const deployOutput = await new Promise((resolve, reject) => {
  let output = "";
  const deploy = spawn(
    "npx",
    ["hardhat", "ignition", "deploy", "ignition/modules/Counter.ts", "--network", "localhost"],
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

// 4. Extraer la dirección del contrato
// Buscar en el directorio de deployments
let contractAddress = null;

// Intentar leer del archivo deployed_addresses.json generado por Ignition
const deploymentsDirs = resolve(HARDHAT_DIR, "ignition/deployments");
if (existsSync(deploymentsDirs)) {
  const chains = readdirSync(deploymentsDirs);
  for (const chain of chains) {
    const addressFile = resolve(deploymentsDirs, chain, "deployed_addresses.json");
    if (existsSync(addressFile)) {
      const addresses = JSON.parse(readFileSync(addressFile, "utf-8"));
      // Buscar la dirección del Counter
      for (const [key, addr] of Object.entries(addresses)) {
        if (key.includes("Counter")) {
          contractAddress = addr;
          break;
        }
      }
    }
  }
}

// Fallback: extraer del output
if (!contractAddress) {
  const match = deployOutput.match(/0x[a-fA-F0-9]{40}/);
  if (match) contractAddress = match[0];
}

if (!contractAddress) {
  console.error(red("No se pudo obtener la dirección del contrato."));
  console.log(deployOutput);
  hardhatNode.kill();
  process.exit(1);
}

log(green(`Contrato desplegado en: ${contractAddress}`));

// 5. Escribir la dirección en .env.local
const envContent = `# Generado automáticamente por scripts/dev.mjs
NEXT_PUBLIC_COUNTER_ADDRESS=${contractAddress}
`;
writeFileSync(ENV_FILE, envContent);
log(`Dirección guardada en .env.local`);

// 6. Arrancar Next.js
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
