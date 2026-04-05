"use client";

/**
 * BookingCard — Tarjeta de reserva activa del estudiante.
 * Molécula que compone Card + Button + QR opcional.
 * El QR se muestra pegado a la derecha dentro de la misma card.
 */

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { QRCodeSVG } from "qrcode.react";

interface BookingCardProps {
  roomName: string;
  roomLocation: string | null;
  date: string;
  startHour: number;
  duration: number;
  onCancel: () => void;
  /** Si se pasa bookingId, muestra el QR */
  bookingId?: number;
}

export function BookingCard({
  roomName,
  roomLocation,
  date,
  startHour,
  duration,
  onCancel,
  bookingId,
}: BookingCardProps) {
  const endHour = startHour + duration;
  const qrValue = bookingId
    ? `CRYPTOCAMPUS-BOOKING:${bookingId}:${roomName}:${date}:${startHour}-${endHour}`
    : "";

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex">
        {/* Info de la reserva — ocupa todo el ancho restante */}
        <div className="flex-1 p-4 space-y-2">
          <div>
            <p className="font-medium text-text">{roomName}</p>
            {roomLocation && <p className="text-xs text-text-muted">{roomLocation}</p>}
          </div>
          <p className="text-sm text-text">
            {new Date(date).toLocaleDateString("es-ES", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
            {" "}
            {startHour}:00 - {endHour}:00
          </p>
          <Button size="sm" variant="danger" onClick={onCancel}>
            Cancelar reserva
          </Button>
        </div>

        {/* QR pegado a la derecha */}
        {bookingId && (
          <div className="flex flex-col items-center justify-center gap-1 border-l border-border-default bg-white px-4">
            <QRCodeSVG value={qrValue} size={96} />
            <p className="text-[10px] text-text-muted text-center">
              Muestra este QR
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
