/**
 * Resetea la blockchain local: borra el estado persistido de Anvil y los
 * deployments de Ignition para forzar un redeploy limpio en el próximo
 * `pnpm dev`.
 *
 * NO toca Postgres ni la BD de Prisma. Para un reset total: `pnpm reset:all`.
 *
 * Uso: node scripts/reset-chain.mjs (o pnpm reset:chain)
 */

import { rmSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const HARDHAT_DIR = resolve(ROOT, "packages/hardhat");

const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

function log(msg) {
	console.log(`${cyan("[reset-chain]")} ${msg}`);
}

const ANVIL_STATE_FILE = resolve(ROOT, ".anvil-state.json");
const DEPLOYMENTS_DIR = resolve(HARDHAT_DIR, "ignition/deployments");

let touched = false;

if (existsSync(ANVIL_STATE_FILE)) {
	rmSync(ANVIL_STATE_FILE, { force: true });
	log(green(`Eliminado .anvil-state.json`));
	touched = true;
}

if (existsSync(DEPLOYMENTS_DIR)) {
	rmSync(DEPLOYMENTS_DIR, { recursive: true, force: true });
	log(green(`Eliminados deployments de Ignition`));
	touched = true;
}

if (!touched) {
	log(yellow("Nada que limpiar — la blockchain ya estaba fresca."));
}

log(green("Próximo 'pnpm dev' redesplegará contratos desde cero."));
