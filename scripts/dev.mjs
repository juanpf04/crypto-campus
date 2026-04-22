/**
 * Script para iniciar todo el entorno de desarrollo:
 *
 *   1. Levanta PostgreSQL con Docker Compose
 *   2. Genera Prisma Client y sincroniza el schema
 *   3. Arranca el nodo blockchain local (Anvil por defecto; Hardhat si
 *      BLOCKCHAIN_NODE=hardhat o flag --hardhat)
 *   4. Despliega los contratos si no lo están ya
 *   5. Ejecuta todos los seeds (idempotentes): admin + datos académicos +
 *      productos + biblioteca + salas + impresoras + insignias
 *   6. Arranca Next.js
 *
 * Con Anvil el estado blockchain persiste entre reinicios (.anvil-state.json).
 * Con Hardhat el estado se pierde al parar (comportamiento histórico).
 *
 * Flags:
 *   --hardhat | --anvil  Fuerza motor blockchain (default: anvil)
 *   --fresh              Resetea BD + estado blockchain antes de arrancar
 *                        (equivalente a 'reset:all' pero Postgres ya estará arriba)
 *
 * Uso: node scripts/dev.mjs (o pnpm dev)
 */

import { spawn } from "child_process";
import { readFileSync, existsSync, readdirSync, rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const HARDHAT_DIR = resolve(ROOT, "packages/hardhat");
const NEXTJS_DIR = resolve(ROOT, "packages/nextjs");

// Motor blockchain — "anvil" (default, estado persistente) o "hardhat"
// (volátil). Se elige por flag CLI (--hardhat/--anvil) o env var
// (BLOCKCHAIN_NODE). El flag CLI tiene prioridad. Por defecto: anvil.
function resolveBlockchainNode() {
	if (process.argv.includes("--hardhat")) return "hardhat";
	if (process.argv.includes("--anvil")) return "anvil";
	const envValue = (process.env.BLOCKCHAIN_NODE ?? "").toLowerCase();
	if (envValue === "hardhat" || envValue === "anvil") return envValue;
	if (envValue) {
		console.error(`BLOCKCHAIN_NODE='${envValue}' no válido. Usa 'anvil' o 'hardhat'.`);
		process.exit(1);
	}
	return "anvil";
}
const BLOCKCHAIN_NODE = resolveBlockchainNode();

const ANVIL_STATE_FILE = resolve(ROOT, ".anvil-state.json");
const DEPLOYMENTS_DIR = resolve(HARDHAT_DIR, "ignition/deployments");

// Flag opcional para resetear BD + blockchain local antes de arrancar. Es
// equivalente a `pnpm reset:all` pero se ejecuta DESPUÉS de levantar Postgres
// (evita errores la primera vez que Postgres aún no está arriba).
const FRESH = process.argv.includes("--fresh");

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
	return new Promise((resolvePromise, rejectPromise) => {
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
				resolvePromise({ code, stdout, stderr });
				return;
			}
			const details = (stderr || stdout).trim();
			const detailSuffix = details ? `\n${details}` : "";
			rejectPromise(new Error(`${command} ${args.join(" ")} falló con código ${code}${detailSuffix}`));
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
	} catch (error) {
		const message = String(error?.message || "");
		const hasNameConflict =
			message.includes("postgres_cryptocampus") &&
			(message.includes("already in use") || message.includes("Conflict"));

		if (hasNameConflict) {
			log(yellow("Detectado conflicto de nombre de contenedor. Reintentando automaticamente..."));
			try {
				await run("docker", ["rm", "-f", "postgres_cryptocampus"], {
					cwd: ROOT,
					prefix: "[db-fix]",
				});
				await run("docker", ["compose", "up", "-d", "db"], {
					cwd: ROOT,
					prefix: "[db]",
				});
				log(green("Base de datos lista en localhost:5435"));
				return;
			} catch {
				// Si falla la recuperacion automatica, cae al mensaje de error general.
			}
		}

		console.error(
			red(
				"No se pudo iniciar la base de datos. Asegura que Docker Desktop este iniciado y vuelve a ejecutar 'pnpm dev'."
			)
		);
		process.exit(1);
	}
}

function runNodeScript(scriptPath, { cwd, prefix, allowFailure = false, nonCriticalMessage } = {}) {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(process.execPath, [scriptPath], {
			cwd,
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
				resolvePromise();
				return;
			}
			rejectPromise(new Error(`${scriptPath} falló con código ${code}`));
		});
	});
}

async function ensurePrismaClient() {
	log("Generando Prisma Client...");
	try {
		await run("pnpm", ["run", "db:generate"], {
			cwd: NEXTJS_DIR,
			prefix: "[prisma]",
		});
		log(green("Prisma Client generado"));
	} catch {
		console.error(
			red(
				"No se pudo generar Prisma Client. Ejecuta 'pnpm db:generate' y vuelve a intentar 'pnpm dev'."
			)
		);
		process.exit(1);
	}
}

async function ensureDatabaseSchema() {
	log("Aplicando esquema Prisma en la base de datos...");
	try {
		await run("pnpm", ["run", "db:push"], {
			cwd: NEXTJS_DIR,
			prefix: "[prisma]",
		});
		log(green("Esquema Prisma sincronizado"));
	} catch {
		console.error(
			red(
				"No se pudo aplicar el esquema Prisma. Ejecuta 'pnpm db:push' y vuelve a intentar 'pnpm dev'."
			)
		);
		process.exit(1);
	}
}

// ── Nodo blockchain ─────────────────────────────────────────────────────────

function startAnvil() {
	log(`Arrancando Anvil${existsSync(ANVIL_STATE_FILE) ? " (cargando estado previo)" : " (estado nuevo)"}...`);
	const args = [
		"--port", "8545",
		"--chain-id", "31337",
		"--state", ANVIL_STATE_FILE,
		"--state-interval", "30",
	];
	const child = spawn("anvil", args, {
		cwd: ROOT,
		stdio: ["ignore", "pipe", "pipe"],
		shell: true,
	});
	child.stderr.on("data", (data) => {
		const msg = data.toString().trim();
		if (msg) console.log(`${yellow("[anvil]")} ${msg}`);
	});
	return child;
}

function startHardhatNode() {
	log("Arrancando nodo de Hardhat...");
	const child = spawn("pnpm", ["exec", "hardhat", "node"], {
		cwd: HARDHAT_DIR,
		stdio: ["ignore", "pipe", "pipe"],
		shell: true,
	});
	child.stderr.on("data", (data) => {
		const msg = data.toString().trim();
		if (msg) console.log(`${yellow("[hardhat]")} ${msg}`);
	});
	return child;
}

function waitForNodeReady(childProcess, label) {
	return new Promise((resolvePromise, rejectPromise) => {
		let ready = false;
		const readyPattern = label === "anvil"
			? /Listening on 127\.0\.0\.1:8545/i
			: /Started HTTP/i;

		const timeout = setTimeout(() => {
			if (!ready) rejectPromise(new Error(`${label} no respondió tras 20s`));
		}, 20000);

		childProcess.stdout.on("data", (data) => {
			const msg = data.toString();
			if (!ready && readyPattern.test(msg)) {
				ready = true;
				clearTimeout(timeout);
				log(green(`${label === "anvil" ? "Anvil" : "Nodo de Hardhat"} listo en http://127.0.0.1:8545`));
				resolvePromise();
			}
		});

		childProcess.on("close", (code) => {
			if (!ready) {
				clearTimeout(timeout);
				if (label === "anvil") {
					rejectPromise(new Error(
						`Anvil no arrancó (código ${code}). ` +
						`Verifica que Foundry está instalado ('anvil --version') o cambia a Hardhat con BLOCKCHAIN_NODE=hardhat.`,
					));
				} else {
					rejectPromise(new Error(`${label} terminó antes de estar listo (código ${code})`));
				}
			}
		});
	});
}

// ── Deploy / detección de contratos ─────────────────────────────────────────

function readDeployedAddresses() {
	if (!existsSync(DEPLOYMENTS_DIR)) return null;
	const chains = readdirSync(DEPLOYMENTS_DIR);
	for (const chain of chains) {
		const addressFile = resolve(DEPLOYMENTS_DIR, chain, "deployed_addresses.json");
		if (existsSync(addressFile)) {
			return JSON.parse(readFileSync(addressFile, "utf-8"));
		}
	}
	return null;
}

/**
 * Comprueba si hay bytecode en la dirección del contrato CampusRoles.
 * Si sí, los contratos están desplegados y saltamos el redeploy.
 */
async function contractsDeployed(addresses) {
	const campusRolesEntry = Object.entries(addresses).find(([k]) => k.includes("CampusRoles"));
	if (!campusRolesEntry) return false;
	const [, address] = campusRolesEntry;

	try {
		const res = await fetch("http://127.0.0.1:8545", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "eth_getCode",
				params: [address, "latest"],
			}),
		});
		const json = await res.json();
		return json.result && json.result !== "0x";
	} catch {
		return false;
	}
}

async function deployContracts() {
	log("Desplegando contratos CampusModule...");
	await new Promise((resolvePromise, rejectPromise) => {
		let output = "";
		const deploy = spawn(
			"pnpm",
			["exec", "hardhat", "ignition", "deploy", "ignition/modules/CampusModule.ts", "--network", "localhost"],
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
			if (code === 0) resolvePromise();
			else rejectPromise(new Error(`Deploy falló con código ${code}\n${output}`));
		});
	});
}

// ──────────────────────────────────────────────────────────────────────────────
// Flujo principal
// ──────────────────────────────────────────────────────────────────────────────

await ensureDatabase();
await ensurePrismaClient();

// Si se pidió --fresh, resetear blockchain local y BD. Postgres ya está
// arriba (ensureDatabase), así que prisma db push --force-reset no falla.
if (FRESH) {
	log(yellow("Flag --fresh: reseteando blockchain local y BD..."));
	if (existsSync(ANVIL_STATE_FILE)) {
		rmSync(ANVIL_STATE_FILE, { force: true });
		log("  - Eliminado .anvil-state.json");
	}
	if (existsSync(DEPLOYMENTS_DIR)) {
		rmSync(DEPLOYMENTS_DIR, { recursive: true, force: true });
		log("  - Eliminados deployments de Ignition");
	}
	try {
		await run("pnpm", ["run", "db:reset"], {
			cwd: NEXTJS_DIR,
			prefix: "[db:reset]",
		});
		log(green("BD reseteada"));
	} catch {
		console.error(red("No se pudo resetear la BD. Revisa que Postgres esté accesible."));
		process.exit(1);
	}
}

await ensureDatabaseSchema();

// 1. Arrancar el nodo blockchain
const useAnvil = BLOCKCHAIN_NODE === "anvil";
log(green(`Motor blockchain: ${useAnvil ? "Anvil (persistente)" : "Hardhat (volátil)"}`));
const nodeProcess = useAnvil ? startAnvil() : startHardhatNode();
await waitForNodeReady(nodeProcess, BLOCKCHAIN_NODE);
await sleep(500);

// 2. Detectar si contratos ya están desplegados
let addresses = readDeployedAddresses();
let needsDeploy = true;
if (addresses) {
	log("Verificando si los contratos ya están desplegados...");
	if (await contractsDeployed(addresses)) {
		log(green("Contratos ya desplegados, saltando deploy"));
		needsDeploy = false;
	} else {
		log(yellow("Addresses guardadas pero sin bytecode en la cadena. Limpio y redesplegamos."));
		rmSync(DEPLOYMENTS_DIR, { recursive: true, force: true });
	}
}

// 3. Deploy si hace falta
if (needsDeploy) {
	await deployContracts();
	addresses = readDeployedAddresses();
	if (!addresses) {
		console.error(red("No se pudieron obtener las direcciones de los contratos tras el deploy."));
		nodeProcess.kill();
		process.exit(1);
	}
	log(green("Contratos desplegados:"));
	for (const [key, addr] of Object.entries(addresses)) {
		const name = key.split("#")[1] || key;
		console.log(`  ${cyan(name)}: ${addr}`);
	}
}

// 4. Resincronizar usuarios de Prisma con la blockchain (idempotente)
log("Resincronizando usuarios existentes con la blockchain...");
await runNodeScript("scripts/resync-users.mjs", {
	cwd: NEXTJS_DIR,
	prefix: "[resync]",
	allowFailure: true,
	nonCriticalMessage: "Resync terminó con errores (no crítico, continuando...)",
});

// 5. Bootstrap del admin primero y explícito — garantiza que SIEMPRE existe
//    un admin aunque el seed completo falle por cualquier motivo.
log("Asegurando que existe un admin en la BD...");
await runNodeScript("scripts/seed-admin.mjs", {
	cwd: NEXTJS_DIR,
	prefix: "[admin]",
	allowFailure: true,
	nonCriticalMessage: "Bootstrap del admin terminó con errores (no crítico, continuando...)",
});

// 6. Seed completo (idempotente): académico + productos + biblioteca + salas +
//    impresoras + insignias + cleanup. En arranques sucesivos con Anvil
//    persistente, los seeds detectan que los datos ya existen y saltan rápido.
//    seed-admin se re-ejecuta aquí como no-op (admin ya existe), coste mínimo.
log("Ejecutando seeds (idempotentes)...");
await runNodeScript("scripts/seed.mjs", {
	cwd: ROOT,
	prefix: "[seed]",
	allowFailure: true,
	nonCriticalMessage: "Seed terminó con errores (continuando al arranque de Next.js...)",
});

// 7. Arrancar Next.js
log("Arrancando Next.js...");
const nextDev = spawn("pnpm", ["exec", "next", "dev"], {
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

function cleanup() {
	log("Cerrando procesos...");
	nodeProcess.kill();
	nextDev.kill();
	process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

await new Promise(() => {});
