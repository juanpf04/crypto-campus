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
 *   --skip-seed          Salta resync de usuarios y todos los seeds (arranca solo
 *                        Postgres + nodo + Next.js, asumiendo que la BD ya está OK)
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

// DEP0190 (Node 24) avisa cuando se combina `args` array + `shell: true`.
// Para evitarlo y mantener compatibilidad con .cmd/.bat de Windows usamos
// shell:true pero pasamos el comando completo como string (sin args). Quote
// asegura que rutas con espacios se preserven.
function quote(arg) {
	if (arg === "") return '""';
	if (/^[A-Za-z0-9_./:=-]+$/.test(arg)) return arg;
	return `"${arg.replace(/(["\\$`])/g, "\\$1")}"`;
}
function buildCmd(command, args) {
	return [command, ...args.map(quote)].join(" ");
}

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

const FRESH = process.argv.includes("--fresh");
const SKIP_SEED = process.argv.includes("--skip-seed");

// Colores para la consola
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function log(msg) {
	console.log(`${cyan("[dev]")} ${msg}`);
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

// ── Step runner: numerado + timing + resumen final ──────────────────────────

let stepIdx = 0;
let totalSteps = 0;
const stepResults = [];

async function step(label, fn, { fatal = true } = {}) {
	stepIdx += 1;
	const start = Date.now();
	console.log(`${cyan(`▶ ${stepIdx}/${totalSteps}`)} ${label}`);
	try {
		const detail = await fn();
		const elapsed = ((Date.now() - start) / 1000).toFixed(1);
		// Solo muestra el sufijo si la función retornó un string informativo.
		// runNodeScript resuelve con { code } y no debe ensuciar el resumen.
		const detailSuffix = typeof detail === "string" && detail ? ` — ${detail}` : "";
		console.log(`${green(`✓ ${stepIdx}/${totalSteps}`)} ${label} (${elapsed}s)${detailSuffix}`);
		stepResults.push({ idx: stepIdx, label, ok: true, time: parseFloat(elapsed) });
		return detail;
	} catch (err) {
		const elapsed = ((Date.now() - start) / 1000).toFixed(1);
		const reason = (err?.message || "error").split("\n")[0];
		console.log(`${red(`✗ ${stepIdx}/${totalSteps}`)} ${label} (${elapsed}s) — ${reason}`);
		stepResults.push({ idx: stepIdx, label, ok: false, time: parseFloat(elapsed), error: err });
		if (fatal) {
			printSummary();
			process.exit(1);
		}
		return null;
	}
}

function printSummary() {
	const ok = stepResults.filter((s) => s.ok).length;
	const failed = stepResults.filter((s) => !s.ok);
	const totalTime = stepResults.reduce((sum, s) => sum + s.time, 0).toFixed(1);
	console.log("");
	if (failed.length === 0) {
		console.log(green(`═══ Bootstrap completo: ${ok}/${totalSteps} OK · ${totalTime}s`));
	} else {
		const failedLabels = failed.map((f) => f.label).join(", ");
		console.log(yellow(`═══ Bootstrap: ${ok}/${totalSteps} OK · ${failed.length} fallo(s): ${failedLabels} · ${totalTime}s`));
	}
	console.log("");
}

// ── Helpers de spawn (sin shell: true para evitar DEP0190) ──────────────────

function run(command, args, { cwd, prefix = "[cmd]", allowFailure = false, quiet = false } = {}) {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(buildCmd(command, args), {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
			shell: true,
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (data) => {
			const msg = data.toString();
			stdout += msg;
			if (quiet) return;
			const trimmed = msg.trim();
			if (trimmed) console.log(`${cyan(prefix)} ${trimmed}`);
		});

		child.stderr.on("data", (data) => {
			const msg = data.toString();
			stderr += msg;
			if (quiet) return;
			const trimmed = msg.trim();
			if (trimmed) console.log(`${yellow(prefix)} ${trimmed}`);
		});

		child.on("error", (err) => {
			rejectPromise(new Error(`${command} no se pudo ejecutar: ${err.message}`));
		});

		child.on("close", (code) => {
			if (code === 0 || allowFailure) {
				resolvePromise({ code, stdout, stderr });
				return;
			}
			// Si íbamos en silent y peta, sacamos lo bufferado para que el error sea diagnosticable.
			if (quiet) {
				const stdoutTrim = stdout.trim();
				const stderrTrim = stderr.trim();
				if (stdoutTrim) console.log(`${cyan(prefix)} ${stdoutTrim}`);
				if (stderrTrim) console.log(`${yellow(prefix)} ${stderrTrim}`);
			}
			const details = (stderr || stdout).trim();
			const detailSuffix = details ? `\n${details}` : "";
			rejectPromise(new Error(`${command} ${args.join(" ")} falló con código ${code}${detailSuffix}`));
		});
	});
}

function runNodeScript(scriptPath, { cwd, prefix, allowFailure = false } = {}) {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(process.execPath, [scriptPath], {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
		});

		child.stdout.on("data", (data) => {
			const msg = data.toString().trim();
			if (msg) console.log(msg);
		});

		child.stderr.on("data", (data) => {
			const msg = data.toString().trim();
			if (msg) console.log(`${yellow(prefix)} ${msg}`);
		});

		child.on("error", (err) => {
			rejectPromise(new Error(`${scriptPath} no se pudo ejecutar: ${err.message}`));
		});

		child.on("close", (code) => {
			if (code === 0 || allowFailure) {
				resolvePromise({ code });
				return;
			}
			rejectPromise(new Error(`${scriptPath} falló con código ${code}`));
		});
	});
}

// ── Acciones individuales ───────────────────────────────────────────────────

async function ensureDatabase() {
	try {
		await run("docker", ["compose", "up", "-d", "db"], { cwd: ROOT, prefix: "[db]" });
	} catch (error) {
		const message = String(error?.message || "");
		const hasNameConflict =
			message.includes("postgres_cryptocampus") &&
			(message.includes("already in use") || message.includes("Conflict"));

		if (hasNameConflict) {
			log(yellow("Detectado conflicto de nombre de contenedor. Reintentando automáticamente..."));
			await run("docker", ["rm", "-f", "postgres_cryptocampus"], { cwd: ROOT, prefix: "[db-fix]" });
			await run("docker", ["compose", "up", "-d", "db"], { cwd: ROOT, prefix: "[db]" });
			return "Postgres en localhost:5435 (recuperado tras conflicto)";
		}
		throw new Error(
			"No se pudo iniciar la base de datos. Asegura que Docker Desktop esté iniciado."
		);
	}
	return "Postgres en localhost:5435";
}

async function ensurePrismaClient() {
	await run("pnpm", ["run", "db:generate"], { cwd: NEXTJS_DIR, prefix: "[prisma]", quiet: true });
}

async function resetFreshState() {
	const removed = [];
	if (existsSync(ANVIL_STATE_FILE)) {
		rmSync(ANVIL_STATE_FILE, { force: true });
		removed.push(".anvil-state.json");
	}
	if (existsSync(DEPLOYMENTS_DIR)) {
		rmSync(DEPLOYMENTS_DIR, { recursive: true, force: true });
		removed.push("ignition/deployments");
	}
	await run("pnpm", ["run", "db:reset"], { cwd: NEXTJS_DIR, prefix: "[db:reset]" });
	return `BD reseteada · borrados: ${removed.join(", ") || "(nada blockchain)"}`;
}

async function ensureDatabaseSchema() {
	await run("pnpm", ["run", "db:push"], { cwd: NEXTJS_DIR, prefix: "[prisma]", quiet: true });
}

// ── Nodo blockchain ─────────────────────────────────────────────────────────

function startAnvil() {
	const args = [
		"--port", "8545",
		"--chain-id", "31337",
		"--state", ANVIL_STATE_FILE,
		"--state-interval", "30",
	];
	const child = spawn(buildCmd("anvil", args), {
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
	const child = spawn(buildCmd("pnpm", ["exec", "hardhat", "node"]), {
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
				resolvePromise();
			}
		});

		childProcess.on("error", (err) => {
			if (!ready) {
				clearTimeout(timeout);
				rejectPromise(new Error(`${label} no se pudo ejecutar: ${err.message}`));
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
	await new Promise((resolvePromise, rejectPromise) => {
		let output = "";
		const deploy = spawn(
			buildCmd("pnpm", ["exec", "hardhat", "ignition", "deploy", "ignition/modules/CampusModule.ts", "--network", "localhost"]),
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

		deploy.on("error", (err) => {
			rejectPromise(new Error(`Deploy no se pudo ejecutar: ${err.message}`));
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

// Calcular total de steps según flags
totalSteps = 5; // postgres + prisma-gen + schema + node + (deploy o "ya desplegados")
if (FRESH) totalSteps += 1; // reset
if (!SKIP_SEED) totalSteps += 2; // resync + seed-completo (admin va dentro de seed)

const flags = [
	BLOCKCHAIN_NODE === "anvil" ? "anvil (persistente)" : "hardhat (volátil)",
	FRESH ? "fresh" : null,
	SKIP_SEED ? "skip-seed" : null,
].filter(Boolean).join(" · ");
log(dim(`Modo: ${flags}`));
console.log("");

// 1. Postgres
await step("PostgreSQL", ensureDatabase);

// 2. Prisma generate
await step("Prisma generate", ensurePrismaClient);

// 3. (opcional) Reset si --fresh
if (FRESH) {
	await step("Reset BD + blockchain", resetFreshState);
}

// 4. Schema sync
await step("Schema Prisma sync", ensureDatabaseSchema);

// 5. Blockchain node
let nodeProcess;
await step(`Blockchain node (${BLOCKCHAIN_NODE})`, async () => {
	nodeProcess = BLOCKCHAIN_NODE === "anvil" ? startAnvil() : startHardhatNode();
	await waitForNodeReady(nodeProcess, BLOCKCHAIN_NODE);
	await sleep(500);
	return `http://127.0.0.1:8545`;
});

// 6. Deploy (o detectar si ya está)
await step("Contratos desplegados", async () => {
	let addresses = readDeployedAddresses();
	let needsDeploy = true;

	if (addresses) {
		if (await contractsDeployed(addresses)) {
			needsDeploy = false;
		} else {
			rmSync(DEPLOYMENTS_DIR, { recursive: true, force: true });
		}
	}

	if (needsDeploy) {
		await deployContracts();
		addresses = readDeployedAddresses();
		if (!addresses) {
			throw new Error("No se obtuvieron las direcciones tras el deploy");
		}
		return `desplegados ${Object.keys(addresses).length} contratos`;
	}
	return "ya desplegados, saltando";
});

// 7-8. Resync + Seeds (saltable con --skip-seed)
// El admin se crea como primer sub-seed dentro del master seed (`seed.mjs`),
// no necesita un step separado.
if (!SKIP_SEED) {
	await step("Resync usuarios", () => runNodeScript("scripts/resync-users.mjs", {
		cwd: NEXTJS_DIR,
		prefix: "[resync]",
		allowFailure: true,
	}), { fatal: false });

	await step("Seeds completos", () => runNodeScript("scripts/seed.mjs", {
		cwd: ROOT,
		prefix: "[seed]",
		allowFailure: true,
	}), { fatal: false });
}

// Resumen antes de arrancar Next.js
printSummary();

// 10. Arrancar Next.js
log("Arrancando Next.js...");
const nextDev = spawn(buildCmd("pnpm", ["exec", "next", "dev"]), {
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
	if (nodeProcess) nodeProcess.kill();
	if (nextDev) nextDev.kill();
	process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

await new Promise(() => {});
