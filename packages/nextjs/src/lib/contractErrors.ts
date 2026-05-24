/**
 * contractErrors.ts — Traducción de errores de contrato y de viem a mensajes legibles.
 *
 * Algunas reverts on-chain (EnforcedPause) y errores técnicos del cliente RPC
 * (nonce too low) producen mensajes gigantes que confunden al usuario. Esta
 * utilidad detecta los más comunes y los reescribe a algo accionable. Se usa
 * en los catch blocks de las server actions que escriben on-chain.
 */

const PAUSE_MARKERS = [
  "EnforcedPause",
  "0xd93c0665", // selector custom error EnforcedPause()
];

const NONCE_MARKERS = [
  "nonce too low",
  "Nonce provided for the transaction is lower",
];

/** ¿El error es por contrato pausado? */
export function isContractPauseError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return PAUSE_MARKERS.some((m) => msg.includes(m));
}

/**
 * ¿El error es por nonce desincronizado? Ocurre típicamente cuando dos
 * transacciones se firmaron con el mismo nonce (carrera) o cuando un nodo
 * local se reinició y el cliente cachea un nonce viejo.
 */
export function isNonceError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return NONCE_MARKERS.some((m) => msg.includes(m));
}

/**
 * ¿Es un error conocido para el que tenemos mensaje específico? Útil en los
 * catches para decidir si propagar el traducido o el genérico del módulo.
 */
export function isKnownContractError(err: unknown): boolean {
  return isContractPauseError(err) || isNonceError(err);
}

/**
 * Si el error encaja con un patrón conocido (pausa, nonce, ...), devuelve un
 * Error con mensaje legible. En caso contrario, devuelve el error original
 * (envuelto si era string).
 */
export function translateContractError(err: unknown, moduleName?: string): Error {
  if (isContractPauseError(err)) {
    const where = moduleName ? `(${moduleName}) ` : "";
    return new Error(
      `Esta funcionalidad ${where}está pausada por el administrador. Inténtalo más tarde.`,
    );
  }
  if (isNonceError(err)) {
    return new Error(
      "Conflicto temporal con una transacción reciente. Espera unos segundos y vuelve a intentarlo.",
    );
  }
  const msg = err instanceof Error ? err.message : String(err);
  return err instanceof Error ? err : new Error(msg);
}
