"use client";

/**
 * LoanCard — Tarjeta de préstamo del estudiante.
 * Muestra estado visual diferente según QUEUED, RESERVED, PICKED_UP.
 */

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HistoricalBadge } from "@/components/shared/HistoricalBadge";

interface LoanCardProps {
  title: string;
  creator: string | null;
  status: string;
  dueDate: string | null;
  reservationDate: string | null;
  queuePosition: number | null;
  historical?: boolean;
  onCancel?: () => void;
}

export function LoanCard({ title, creator, status, dueDate, reservationDate, queuePosition, historical, onCancel }: LoanCardProps) {
  const isOverdue = status === "PICKED_UP" && dueDate && new Date(dueDate) < new Date();

  // Calcular fecha límite de recogida (reservationDate + 3 días)
  const pickupDeadline = reservationDate
    ? new Date(new Date(reservationDate).getTime() + 3 * 24 * 60 * 60 * 1000)
    : null;

  return (
    <Card className={`p-4 space-y-2 ${isOverdue ? "border-danger/50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-text">{title}</p>
          {creator && <p className="text-sm text-text-muted">{creator}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {historical && <HistoricalBadge />}
          <StatusBadge status={status} />
        </div>
      </div>

      {/* QUEUED: posición en cola */}
      {status === "QUEUED" && queuePosition != null && (
        <p className="text-sm text-warning font-medium">
          Posición #{queuePosition} en la lista de espera
        </p>
      )}

      {/* RESERVED: fecha límite de recogida */}
      {status === "RESERVED" && pickupDeadline && (
        <p className="text-sm text-info">
          Recoge antes del {pickupDeadline.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
        </p>
      )}

      {/* PICKED_UP: fecha de devolución */}
      {status === "PICKED_UP" && dueDate && (
        <>
          <p className={`text-sm ${isOverdue ? "text-danger font-medium" : "text-text-muted"}`}>
            {isOverdue
              ? "Préstamo vencido — devuelve cuanto antes"
              : `Devolver antes del ${new Date(dueDate).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}`
            }
          </p>
          <p className="text-xs text-text-muted italic">
            Devuelve el ítem al bibliotecario en el mostrador
          </p>
        </>
      )}

      {/* Botón cancelar (solo QUEUED y RESERVED) */}
      {(status === "QUEUED" || status === "RESERVED") && onCancel && (
        <Button size="sm" variant="danger" onClick={onCancel}>
          {status === "QUEUED" ? "Salir de la cola" : "Cancelar reserva"}
        </Button>
      )}
    </Card>
  );
}
