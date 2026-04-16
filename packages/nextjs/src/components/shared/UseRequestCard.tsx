"use client";

/**
 * UseRequestCard — Tarjeta de solicitud de uso de recompensa.
 * Muestra estado, recompensa asociada y acciones según el rol.
 */

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/shared/StatusBadge";

const USE_REQUEST_STATUS: Record<number, string> = {
  1: "PENDING",
  2: "APPROVED",
  3: "REJECTED",
  4: "CANCELLED",
};

interface UseRequestCardProps {
  requestId: number;
  rewardName: string;
  subjectName: string;
  status: number;
  /** Acciones para el estudiante */
  onCancel?: () => void;
  /** Acciones para el profesor/admin */
  onApprove?: () => void;
  onReject?: () => void;
  processing?: boolean;
}

export function UseRequestCard({
  requestId,
  rewardName,
  subjectName,
  status,
  onCancel,
  onApprove,
  onReject,
  processing,
}: UseRequestCardProps) {
  const statusKey = USE_REQUEST_STATUS[status] || "PENDING";

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-text">{rewardName}</p>
          <p className="text-sm text-text-muted">{subjectName}</p>
        </div>
        <StatusBadge status={statusKey} />
      </div>

      <p className="text-xs text-text-muted">Solicitud #{requestId}</p>

      {status === 1 && onCancel && (
        <Button size="sm" variant="danger" onClick={onCancel} loading={processing}>
          Cancelar solicitud
        </Button>
      )}

      {status === 1 && (onApprove || onReject) && (
        <div className="flex gap-2">
          {onApprove && (
            <Button size="sm" onClick={onApprove} loading={processing}>
              Aprobar
            </Button>
          )}
          {onReject && (
            <Button size="sm" variant="danger" onClick={onReject} disabled={processing}>
              Rechazar
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
