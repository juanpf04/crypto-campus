"use client";

/**
 * Grid visual de disponibilidad horaria de una sala.
 * Muestra slots de 1 hora con colores según disponibilidad.
 * Permite seleccionar hasta 4 horas consecutivas clicando en cada slot.
 *
 * Lógica de selección:
 * - Primer click: selecciona 1 hora
 * - Clicks siguientes: extiende la selección si la hora es adyacente y consecutiva (máx 4h)
 * - Click en hora no adyacente o ya seleccionada: reinicia la selección
 */

import { useCallback, useState } from "react";

interface RoomAvailabilityGridProps {
  availability: boolean[];
  fromHour?: number;
  toHour?: number;
  onSelect?: (startHour: number, duration: number) => void;
  readOnly?: boolean;
}

export function RoomAvailabilityGrid({
  availability,
  fromHour = 8,
  toHour = 22,
  onSelect,
  readOnly = false,
}: RoomAvailabilityGridProps) {
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<number | null>(null);

  const hours = Array.from({ length: toHour - fromHour }, (_, i) => fromHour + i);

  const isSelected = useCallback(
    (hour: number) => {
      if (selectedStart === null || selectedEnd === null) return false;
      return hour >= selectedStart && hour < selectedEnd;
    },
    [selectedStart, selectedEnd],
  );

  function handleClick(hour: number) {
    if (readOnly || !availability[hour]) return;

    // Si no hay selección previa, empezar nueva
    if (selectedStart === null || selectedEnd === null) {
      setSelectedStart(hour);
      setSelectedEnd(hour + 1);
      onSelect?.(hour, 1);
      return;
    }

    // Si hace click en una hora ya seleccionada, reducir la selección
    if (isSelected(hour)) {
      // Si solo queda 1 hora, deseleccionar todo
      if (selectedEnd - selectedStart === 1) {
        setSelectedStart(null);
        setSelectedEnd(null);
        onSelect?.(0, 0);
        return;
      }

      // Quitar desde el borde más cercano
      if (hour === selectedStart) {
        // Quitar desde el inicio
        const newStart = hour + 1;
        setSelectedStart(newStart);
        onSelect?.(newStart, selectedEnd - newStart);
      } else if (hour === selectedEnd - 1) {
        // Quitar desde el final
        const newEnd = hour;
        setSelectedEnd(newEnd);
        onSelect?.(selectedStart, newEnd - selectedStart);
      } else {
        // Click en el medio: recortar hasta ese punto (mantener desde el inicio)
        setSelectedEnd(hour);
        onSelect?.(selectedStart, hour - selectedStart);
      }
      return;
    }

    // Intentar extender la selección
    let newStart = selectedStart;
    let newEnd = selectedEnd;

    if (hour === selectedEnd) {
      // Extender hacia adelante
      newEnd = hour + 1;
    } else if (hour === selectedStart - 1) {
      // Extender hacia atrás
      newStart = hour;
    } else {
      // No es adyacente: reiniciar
      setSelectedStart(hour);
      setSelectedEnd(hour + 1);
      onSelect?.(hour, 1);
      return;
    }

    const duration = newEnd - newStart;

    // Límite de 4 horas
    if (duration > 4) return;

    // Verificar que todas las horas intermedias están disponibles
    for (let h = newStart; h < newEnd; h++) {
      if (!availability[h]) return;
    }

    setSelectedStart(newStart);
    setSelectedEnd(newEnd);
    onSelect?.(newStart, duration);
  }

  function getSlotStyle(hour: number) {
    const selected = isSelected(hour);
    if (selected) return "bg-primary text-white border-primary";
    if (!availability[hour]) return "bg-danger/20 text-danger/60 border-danger/30 cursor-default";
    if (readOnly) return "bg-success/10 text-success border-success/30 cursor-default";
    return "bg-success/10 text-success border-success/30 hover:bg-success/20 cursor-pointer";
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-1.5 md:grid-cols-14">
        {hours.map((hour) => (
          <button
            key={hour}
            type="button"
            onClick={() => handleClick(hour)}
            disabled={readOnly || !availability[hour]}
            className={`rounded-md border px-2 py-2.5 text-xs font-medium transition-colors ${getSlotStyle(hour)}`}
          >
            {hour}:00
          </button>
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded border border-success/30 bg-success/10" />
          Disponible
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded border border-danger/30 bg-danger/20" />
          Ocupado
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded border border-primary bg-primary" />
          Seleccionado
        </span>
      </div>

      {selectedStart !== null && selectedEnd !== null && !readOnly && (
        <p className="text-sm text-text-muted">
          Seleccionado: <span className="font-medium text-text">{selectedStart}:00 - {selectedEnd}:00</span>{" "}
          ({selectedEnd - selectedStart}h)
          {selectedEnd - selectedStart < 4 && (
            <span className="text-text-muted"> — click en la hora adyacente para ampliar (máx 4h)</span>
          )}
        </p>
      )}
    </div>
  );
}
