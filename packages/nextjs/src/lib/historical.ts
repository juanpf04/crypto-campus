/**
 * historical.ts — Helpers para entidades con flag `historical`.
 *
 * Los registros históricos viven solo en Prisma (no tienen contraparte on-chain
 * ni `txHash` ni id numérico del contrato). Cualquier acción que vaya a llamar
 * a un contrato debe pasar por estos guards para fallar pronto y con un mensaje
 * legible para el usuario.
 *
 * Uso típico:
 *
 *   const loan = await prisma.loan.findUnique({ where: { id: loanId } });
 *   ensureOnChainId(loan, "loanId", "Préstamo");
 *   // a partir de aquí TS sabe que loan.loanId es number (no null)
 *   await wallet.writeContract({ args: [BigInt(loan.loanId)] });
 *
 * O con lock previo:
 *
 *   const loans = await prisma.loan.findMany({ where: { ...ONLY_LIVE, status: "PICKED_UP" } });
 */

interface HistoricalEntity {
	historical?: boolean;
}

/** Filtro reutilizable de Prisma: solo registros vivos (con respaldo on-chain). */
export const ONLY_LIVE = { historical: false } as const;

/**
 * Lanza si la entidad es histórica. Usar cuando NO se va a tocar el id on-chain
 * pero igualmente queremos prohibir la acción (p. ej. reescritura de metadatos
 * sensibles ligados a un evento on-chain).
 */
export function ensureNotHistorical(
	entity: HistoricalEntity | null | undefined,
	entityName = "Registro",
): void {
	if (!entity) return;
	if (entity.historical) {
		throw new Error(
			`${entityName} histórico (sin firma on-chain). Esta acción no está disponible.`,
		);
	}
}

/**
 * Lanza si la entidad es histórica O si su id on-chain es null. Esta es la
 * variante a usar antes de cualquier `writeContract`/`readContract` que pase
 * el id como argumento. Tras la llamada, TS infiere que el id es no-nullable.
 */
export function ensureOnChainId<
	T extends HistoricalEntity,
	K extends keyof T,
>(
	entity: T | null | undefined,
	idField: K,
	entityName = "Registro",
): asserts entity is T & { [P in K]: NonNullable<T[P]> } {
	if (!entity) {
		throw new Error(`${entityName} no encontrado`);
	}
	if (entity.historical) {
		throw new Error(
			`${entityName} histórico (sin firma on-chain). Esta acción no está disponible.`,
		);
	}
	if (entity[idField] === null || entity[idField] === undefined) {
		throw new Error(
			`${entityName} sin id on-chain. Esta acción no está disponible.`,
		);
	}
}
