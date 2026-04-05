"use client";

/**
 * Modal para confirmar la reserva de una sala.
 * Muestra resumen (sala, fecha, horario) y botón de confirmar.
 */

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  roomName: string;
  date: string;
  startHour: number;
  duration: number;
}

export function BookingModal({
  open,
  onClose,
  onConfirm,
  loading,
  roomName,
  date,
  startHour,
  duration,
}: BookingModalProps) {
  const endHour = startHour + duration;

  return (
    <Modal open={open} onClose={onClose} title="Confirmar reserva">
      <div className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Sala</span>
            <span className="font-medium text-text">{roomName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Fecha</span>
            <span className="font-medium text-text">
              {new Date(date).toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Horario</span>
            <span className="font-medium text-text">
              {startHour}:00 - {endHour}:00 ({duration}h)
            </span>
          </div>
        </div>

        <p className="text-xs text-text-muted">
          Recuerda: solo puedes reservar 1 sala al día, máximo 4 horas consecutivas.
        </p>

        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} loading={loading}>
            Confirmar reserva
          </Button>
        </div>
      </div>
    </Modal>
  );
}
