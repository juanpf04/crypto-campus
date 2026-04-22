/**
 * Pobla BD + blockchain con datos de prueba.
 *
 * Requiere que `pnpm dev` esté corriendo en otra terminal (necesita Postgres
 * levantado, el nodo blockchain activo y los contratos desplegados).
 *
 * Todos los seeds son idempotentes: no pisan datos existentes, solo crean lo
 * que falta. Seguro ejecutarlo varias veces.
 *
 * Uso: node scripts/seed.mjs (o pnpm db:seed)
 */

import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const NEXTJS_DIR = resolve(ROOT, "packages/nextjs");

const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

function log(msg) {
	console.log(`${cyan("[seed]")} ${msg}`);
}

function runNodeScript(scriptName, { prefix, allowFailure = false, nonCriticalMessage } = {}) {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(process.execPath, [scriptName], {
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
				resolvePromise();
				return;
			}
			rejectPromise(new Error(`${scriptName} falló con código ${code}`));
		});
	});
}

const seeds = [
	{ name: "admin",     file: "scripts/seed-admin.mjs",     label: "Admin por defecto" },
	{ name: "librarian", file: "scripts/seed-librarian.mjs", label: "Bibliotecario por defecto" },
	{ name: "academic",  file: "scripts/seed-academic.mjs",  label: "Datos académicos (profesores, estudiantes, asignaturas, matrículas, insignias/recompensas demo)" },
	{ name: "products", file: "scripts/seed-products.mjs", label: "Catálogo de productos de la tienda" },
	{ name: "badges",   file: "scripts/seed-badges.mjs",   label: "Tareas y premios de insignias" },
	{ name: "library",  file: "scripts/seed-library.mjs",  label: "Catálogo de biblioteca" },
	{ name: "rooms",    file: "scripts/seed-rooms.mjs",    label: "Salas de estudio" },
	{ name: "printers", file: "scripts/seed-printers.mjs", label: "Impresoras del campus" },
	{ name: "cleanup",  file: "scripts/cleanup-uploads.mjs", label: "Limpieza de archivos expirados (> 24h)" },
];

log("Ejecutando seeds (idempotentes)...");

for (const s of seeds) {
	log(`${s.label}...`);
	try {
		await runNodeScript(s.file, {
			prefix: `[seed-${s.name}]`,
			allowFailure: true,
			nonCriticalMessage: `Seed '${s.name}' terminó con errores (no crítico, continuando...)`,
		});
	} catch (err) {
		console.error(red(`Error fatal en seed '${s.name}': ${err.message}`));
		process.exit(1);
	}
}

log(green("Seed completo. BD y blockchain sincronizadas."));
