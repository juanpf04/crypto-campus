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

function runNodeScript(scriptName, { prefix } = {}) {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(process.execPath, [scriptName], {
			cwd: NEXTJS_DIR,
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
			rejectPromise(new Error(`${scriptName} no se pudo ejecutar: ${err.message}`));
		});

		child.on("close", (code) => {
			if (code === 0) resolvePromise();
			else rejectPromise(new Error(`código ${code}`));
		});
	});
}

const seeds = [
	{ name: "admin",     file: "scripts/seed-admin.mjs",     label: "Admin por defecto" },
	{ name: "librarian", file: "scripts/seed-librarian.mjs", label: "Bibliotecario por defecto" },
	{ name: "academic",  file: "scripts/seed-academic.mjs",  label: "Datos académicos (profesores, estudiantes, asignaturas, matrículas)" },
	{ name: "products",  file: "scripts/seed-products.mjs",  label: "Catálogo de productos" },
	{ name: "badges",    file: "scripts/seed-badges.mjs",    label: "Tareas y premios de insignias" },
	{ name: "library",   file: "scripts/seed-library.mjs",   label: "Catálogo de biblioteca" },
	{ name: "rooms",      file: "scripts/seed-rooms.mjs",      label: "Salas de estudio" },
	{ name: "printers",   file: "scripts/seed-printers.mjs",   label: "Impresoras del campus" },
	{ name: "historical", file: "scripts/seed-historical.mjs", label: "Datos históricos para gráficas (solo Prisma, sin on-chain)" },
	{ name: "cleanup",    file: "scripts/cleanup-uploads.mjs", label: "Limpieza de archivos expirados" },
];

const total = seeds.length;
const results = [];

log(`Ejecutando ${total} seeds (idempotentes)...`);
console.log("");

for (let i = 0; i < seeds.length; i++) {
	const s = seeds[i];
	const idx = i + 1;
	const start = Date.now();
	console.log(`${cyan(`▶ ${idx}/${total}`)} ${s.label}`);
	try {
		await runNodeScript(s.file, { prefix: `[seed-${s.name}]` });
		const elapsed = ((Date.now() - start) / 1000).toFixed(1);
		console.log(`${green(`✓ ${idx}/${total}`)} ${s.label} (${elapsed}s)`);
		results.push({ name: s.name, ok: true, time: parseFloat(elapsed) });
	} catch (err) {
		const elapsed = ((Date.now() - start) / 1000).toFixed(1);
		console.log(`${red(`✗ ${idx}/${total}`)} ${s.label} (${elapsed}s) — ${err.message}`);
		results.push({ name: s.name, ok: false, time: parseFloat(elapsed), error: err });
	}
}

const ok = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
const totalTime = results.reduce((sum, r) => sum + r.time, 0).toFixed(1);

console.log("");
if (failed.length === 0) {
	console.log(green(`═══ Seeds: ${ok}/${total} OK · ${totalTime}s`));
} else {
	const failedNames = failed.map((f) => f.name).join(", ");
	console.log(yellow(`═══ Seeds: ${ok}/${total} OK · ${failed.length} fallo(s): ${failedNames} · ${totalTime}s`));
	process.exit(1);
}
