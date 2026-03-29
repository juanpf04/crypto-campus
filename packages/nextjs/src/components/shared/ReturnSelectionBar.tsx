"use client";

/**
 * ReturnSelectionBar — Barra flotante para devolver artículos seleccionados.
 *
 * Componente intermedio que compone FloatingActionBar (atómico) + Button (atómico).
 * Muestra el resumen de la selección y el botón de devolución.
 * Para admin puede incluir también "Entregar selección".
 *
 * Se usa en: detalle batch estudiante y admin.
 */

import { FloatingActionBar } from "@/components/ui/FloatingActionBar";
import { Button } from "@/components/ui/Button";

interface ReturnSelectionBarProps {
  /** Total de artículos seleccionados */
  selectedCount: number;
  /** Total de ShopTokens a reembolsar */
  totalRefund: number;
  /** Callback al pulsar "Devolver selección" */
  onReturn: () => void;
  /** Estado de carga */
  loading?: boolean;
  /** Callback al pulsar "Entregar selección" (solo admin) */
  onDeliver?: () => void;
  deliverLoading?: boolean;
  /** Cuántos seleccionados son entregables (PAID) */
  deliverableSelected?: number;
}

export function ReturnSelectionBar({
  selectedCount,
  totalRefund,
  onReturn,
  loading,
  onDeliver,
  deliverLoading,
  deliverableSelected = 0,
}: ReturnSelectionBarProps) {
  return (
    <FloatingActionBar visible={selectedCount > 0}>
      <div className="flex-1">
        <p className="text-sm font-medium text-text">
          {selectedCount} artículo{selectedCount !== 1 ? "s" : ""} seleccionado{selectedCount !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-text-muted">
          Reembolso: {totalRefund} ShopTokens
        </p>
      </div>

      <div className="flex items-center gap-2">
        {onDeliver && deliverableSelected > 0 && (
          <Button
            size="sm"
            onClick={onDeliver}
            loading={deliverLoading}
          >
            Entregar ({deliverableSelected})
          </Button>
        )}

        <Button
          variant="danger"
          size="sm"
          onClick={onReturn}
          loading={loading}
        >
          Devolver ({selectedCount})
        </Button>
      </div>
    </FloatingActionBar>
  );
}
