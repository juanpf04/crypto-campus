"use client";

import { Badge } from "@/components/ui/Badge";

/**
 * Badge gris discreto que marca registros con `historical: true`.
 *
 * Estos registros viven solo en Prisma (sin firma on-chain). Sirven para que
 * las gráficas/dashboards tengan datos en una instalación recién seedeada,
 * pero no se pueden tocar desde la UI: cualquier acción on-chain (cancelar,
 * devolver, marcar entregado, etc.) los rechaza vía `ensureOnChainId`.
 */
export function HistoricalBadge() {
	return (
		<Badge variant="neutral" className="cursor-help">
			<span title="Registro previo a la integración blockchain. No tiene firma on-chain.">
				Histórico
			</span>
		</Badge>
	);
}
