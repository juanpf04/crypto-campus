/**
 * crypto.ts — Cifrado simétrico AES-256-GCM para datos sensibles.
 *
 * Se usa para cifrar las claves privadas de los wallets Ethereum de los
 * usuarios antes de guardarlas en la base de datos. Así, aunque alguien
 * acceda a la BD, no puede leer las claves privadas sin la SESSION_SECRET.
 *
 * Algoritmo: AES-256-GCM (cifrado autenticado)
 * - AES-256: cifrado simétrico con clave de 256 bits (32 bytes).
 * - GCM: modo que además de cifrar, genera un "authTag" que permite
 *   verificar que los datos no han sido manipulados (integridad).
 *
 * Flujo de CIFRADO (encrypt):
 * 1. Se genera un IV (Initialization Vector) aleatorio de 16 bytes.
 *    El IV garantiza que cifrar el mismo texto dos veces produce
 *    resultados diferentes (evita patrones detectables).
 * 2. Se crea un cipher con el algoritmo, la clave y el IV.
 * 3. Se cifra el texto en dos pasos: update() + final() → texto cifrado en hex.
 * 4. Se extrae el authTag (firma de integridad) del cipher.
 * 5. Se devuelve todo junto en formato "iv:authTag:encrypted" (hex separado por :).
 *
 * Flujo de DESCIFRADO (decrypt):
 * 1. Se separa el string "iv:authTag:encrypted" en sus tres partes.
 * 2. Se reconstruyen los Buffers desde hex.
 * 3. Se crea un decipher con el mismo algoritmo, clave e IV.
 * 4. Se establece el authTag → si los datos fueron manipulados, final() lanzará error.
 * 5. Se descifra: update() + final() → texto original.
 *
 * Clave: se deriva de SESSION_SECRET, rellenada/truncada a exactamente 32 bytes.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

/**
 * Clave de cifrado derivada de SESSION_SECRET.
 * padEnd(32, "0") → si la secret tiene menos de 32 chars, rellena con "0".
 * slice(0, 32)    → si tiene más de 32, la trunca.
 * Resultado: siempre exactamente 32 bytes (256 bits) como requiere AES-256.
 */
const KEY = Buffer.from(
  process.env.SESSION_SECRET!.padEnd(32, "0").slice(0, 32)
);

/**
 * encrypt — Cifra un texto plano y devuelve "iv:authTag:encrypted" en hex.
 * Uso: const encrypted = encrypt(privateKey); → guardar en BD.
 */
export function encrypt(text: string): string {
  // IV aleatorio: garantiza que cifrar lo mismo dos veces da resultado diferente
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);

  // Cifrado en dos pasos (update procesa el texto, final cierra el bloque)
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  // AuthTag: firma de integridad generada por GCM
  const authTag = cipher.getAuthTag().toString("hex");

  // Formato final: las tres piezas necesarias para descifrar, separadas por ":"
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * decrypt — Descifra un string en formato "iv:authTag:encrypted".
 * Uso: const privateKey = decrypt(user.encryptedKey); → usar para firmar tx.
 */
export function decrypt(data: string): string {
  // Separar las tres partes del formato "iv:authTag:encrypted"
  const [ivHex, authTagHex, encrypted] = data.split(":");

  // Reconstruir los Buffers desde hexadecimal
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);

  // Establecer el authTag: si alguien modificó los datos cifrados, aquí fallará
  decipher.setAuthTag(authTag);

  // Descifrado en dos pasos
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8"); // Si el authTag no coincide, lanza error aquí

  return decrypted;
}
