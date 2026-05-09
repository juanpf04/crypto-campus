"use client";

/**
 * BatchHeader — Cabecera reutilizable para el detalle de un pedido (batch).
 *
 * Muestra: título con nº de recibo, badge de estado, fecha,
 * nº de artículos, total, y opcionalmente info del usuario (admin).
 *
 * Compone: BatchStatusBadge (intermedio).
 * Se usa en: detalle batch estudiante y detalle batch admin.
 */

import { BatchStatusBadge } from "@/components/shared/BatchStatusBadge";
import { HistoricalBadge } from "@/components/shared/HistoricalBadge";
import { formatShortDate } from "@/lib/formatters";

interface BatchHeaderProps {
  /** ID on-chain del batch. `null` en pedidos históricos sin contraparte on-chain. */
  batchId: number | null;
  generalStatus: string;
  purchaseDate: string;
  itemCount: number;
  totalPaid: number;
  /** Info del usuario (solo admin) */
  user?: { name: string; email: string };
  /** Marca el pedido como histórico (muestra badge, oculta el `#batchId`). */
  historical?: boolean;
  /** Contenido extra a la derecha (botones de acción del admin) */
  actions?: React.ReactNode;
}

export function BatchHeader({
  batchId,
  generalStatus,
  purchaseDate,
  itemCount,
  totalPaid,
  user,
  historical,
  actions,
}: BatchHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-text">
            {batchId !== null ? `Pedido #${batchId}` : "Pedido histórico"}
          </h1>
          <BatchStatusBadge status={generalStatus} />
          {historical && <HistoricalBadge />}
        </div>
        <p className="text-sm text-text-muted">
          {user && <>{user.name} ({user.email}) &middot; </>}
          {formatShortDate(purchaseDate)} &middot; {itemCount} artículo{itemCount !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <p className="text-2xl font-bold text-primary">{totalPaid} ShopTokens</p>
        {actions}
      </div>
    </div>
  );
}
