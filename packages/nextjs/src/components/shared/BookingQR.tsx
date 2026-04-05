"use client";

/**
 * BookingQR — Código QR simulado para reservas de salas.
 * Molécula que compone qrcode.react + texto informativo.
 */

import { QRCodeSVG } from "qrcode.react";

interface BookingQRProps {
  bookingId: number;
  roomName: string;
  date: string;
  startHour: number;
  duration: number;
}

export function BookingQR({ bookingId, roomName, date, startHour, duration }: BookingQRProps) {
  const endHour = startHour + duration;
  const qrValue = `CRYPTOCAMPUS-BOOKING:${bookingId}:${roomName}:${date}:${startHour}-${endHour}`;

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border-default bg-white p-4">
      <QRCodeSVG value={qrValue} size={120} />
      <p className="text-[10px] text-text-muted text-center">
        Muestra este QR para acceder a la sala
      </p>
    </div>
  );
}
