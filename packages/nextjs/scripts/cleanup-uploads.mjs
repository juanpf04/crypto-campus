/**
 * cleanup-uploads.mjs
 *
 * Elimina archivos de impresión temporales con más de 24 horas.
 * Se ejecuta automáticamente al arrancar el servidor desde dev.mjs.
 *
 * Los archivos se guardan en packages/nextjs/uploads/prints/
 * con nombre UUID para evitar colisiones.
 *
 * Uso: node scripts/cleanup-uploads.mjs
 */

import { readdirSync, statSync, unlinkSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = resolve(__dirname, "../uploads/prints");
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas

const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

function log(msg) {
  console.log(`${cyan("[cleanup]")} ${msg}`);
}

if (!existsSync(UPLOAD_DIR)) {
  log("No hay directorio de uploads. Nada que limpiar.");
  process.exit(0);
}

const files = readdirSync(UPLOAD_DIR);
const now = Date.now();
let deleted = 0;

for (const file of files) {
  try {
    const filePath = resolve(UPLOAD_DIR, file);
    const fileStat = statSync(filePath);
    const ageMs = now - fileStat.mtimeMs;

    if (ageMs > MAX_AGE_MS) {
      unlinkSync(filePath);
      deleted++;
    }
  } catch {
    // Si no se puede leer/borrar un archivo, continuar con el siguiente
  }
}

if (deleted > 0) {
  log(green(`Eliminados ${deleted} archivo(s) expirados.`));
} else {
  log("No hay archivos expirados.");
}
