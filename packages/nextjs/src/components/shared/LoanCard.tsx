"use client";

/**
 * LoanCard — Tarjeta de préstamo activo del estudiante.
 * Molécula que compone Card + StatusBadge + Button.
 */

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface LoanCardProps {
  title: string;
  creator: string | null;
  status: string;
  dueDate: string | null;
  /** Si el préstamo es cancelable (status REQUESTED) */
  cancellable?: boolean;
  onCancel?: () => void;
}

export function LoanCard({ title, creator, status, dueDate, cancellable, onCancel }: LoanCardProps) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-text">{title}</p>
          {creator && <p className="text-sm text-text-muted">{creator}</p>}
        </div>
        <StatusBadge status={status} />
      </div>
      {dueDate && (
        <p className="text-xs text-text-muted">
          Vence: {new Date(dueDate).toLocaleDateString("es-ES")}
        </p>
      )}
      {status === "APPROVED" && (
        <p className="text-xs text-text-muted italic">
          Para devolver este ítem, acude a la biblioteca. El bibliotecario confirmará la devolución.
        </p>
      )}
      {cancellable && onCancel && (
        <Button size="sm" variant="danger" onClick={onCancel}>
          Cancelar solicitud
        </Button>
      )}
    </Card>
  );
}
