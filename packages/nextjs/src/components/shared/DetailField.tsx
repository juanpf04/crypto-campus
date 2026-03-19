"use client";

/**
 * Par clave-valor para fichas técnicas y vistas de detalle.
 *
 * Muestra un label en texto muted y un valor debajo en texto principal.
 * Opcionalmente acepta un icono a la izquierda.
 *
 * Reutilizable en detalle de impresión, detalle de préstamo,
 * detalle de pedido, perfil de usuario, etc.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DetailFieldProps {
  /** Etiqueta descriptiva (ej. "Impresora", "Fecha") */
  label: string;
  /** Valor a mostrar */
  value: ReactNode;
  /** Icono opcional a la izquierda del campo */
  icon?: ReactNode;
  /** Clase CSS adicional */
  className?: string;
}

export function DetailField({ label, value, icon, className }: DetailFieldProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      {icon && (
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary mt-0.5">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        <div className="text-sm text-text mt-0.5">{value}</div>
      </div>
    </div>
  );
}
