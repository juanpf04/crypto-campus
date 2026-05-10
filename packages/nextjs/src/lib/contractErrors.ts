/**
 * contractErrors.ts — Traducción de errores de contrato a mensajes legibles.
 *
 * Algunas reverts on-chain producen errores con stacks gigantes que confunden
 * al usuario. Esta utilidad detecta los más comunes y los reescribe a algo
 * accionable. Se usa en los catch blocks de las server actions que escriben
 * on-chain (capa B / defensa en profundidad — la primaria es <ModuleGuard>
 * en el server-side rendering).
 */

const PAUSE_MARKERS = [
  "EnforcedPause",
  "0xd93c0665", // selector custom error EnforcedPause()
];

/** ¿El error es por contrato pausado? Útil para decidir si envolvemos o no. */
export function isContractPauseError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return PAUSE_MARKERS.some((m) => msg.includes(m));
}

/**
 * Si el error indica que el contrato estaba pausado, devuelve un Error con
 * mensaje legible. Si no, devuelve el error original (envuelto si era string).
 */
export function translateContractError(err: unknown, moduleName?: string): Error {
  if (isContractPauseError(err)) {
    const where = moduleName ? `(${moduleName}) ` : "";
    return new Error(
      `Esta funcionalidad ${where}está pausada por el administrador. Inténtalo más tarde.`,
    );
  }
  const msg = err instanceof Error ? err.message : String(err);
  return err instanceof Error ? err : new Error(msg);
}
