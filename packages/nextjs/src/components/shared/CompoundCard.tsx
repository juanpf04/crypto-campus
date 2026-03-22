"use client";

/**
 * Card compuesta con icono + título + valores divididos.
 *
 * Se usa en los dashboards para mostrar múltiples métricas
 * dentro de una sola card (ej: Recompensas usadas/pendientes/disponibles,
 * préstamos solicitudes/activos/vencidos, usuarios por rol, etc.).
 *
 * Cada "slot" tiene un valor, una etiqueta y un color.
 */

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface CompoundCardSlot {
  /** Valor principal (número o "—" como placeholder) */
  value: string | number;
  /** Etiqueta debajo del valor */
  label: string;
  /** Color Tailwind del valor (ej: "text-success", "text-warning") */
  color?: string;
}

interface CompoundCardProps {
  /** Icono del encabezado */
  icon: ReactNode;
  /** Título de la card */
  title: string;
  /** Slots con los valores a mostrar divididos */
  slots: CompoundCardSlot[];
  className?: string;
}

export function CompoundCard({ icon, title, slots, className }: CompoundCardProps) {
  return (
    <Card className={cn("flex items-start gap-4", className)}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-muted">{title}</p>
        <div className="mt-2 flex items-center divide-x divide-border-default">
          {slots.map((slot, i) => (
            <div
              key={slot.label}
              className={cn(
                i === 0 && "pr-6",
                i > 0 && i < slots.length - 1 && "px-6",
                i === slots.length - 1 && slots.length > 1 && "pl-6",
              )}
            >
              <p className={cn("text-xl font-bold", slot.color ?? "text-text")}>
                {slot.value}
              </p>
              <p className="text-xs text-text-muted">{slot.label}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
