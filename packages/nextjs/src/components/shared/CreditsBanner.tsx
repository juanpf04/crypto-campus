"use client";

/**
 * Banner horizontal que muestra créditos/tokens disponibles.
 *
 * Diseño: icono a la izquierda en cuadrado primary, número grande
 * a la derecha con etiqueta descriptiva. Reutilizable para cualquier
 * módulo con créditos o tokens (impresión, biblioteca, tienda...).
 */

import { Card } from "@/components/ui/Card";
import type { ReactNode } from "react";

interface CreditsBannerProps {
  /** Icono representativo (ej: icons.print, icons.token) */
  icon: ReactNode;
  /** Cantidad de créditos/tokens */
  value: number | string;
  /** Texto principal (ej: "Créditos de impresión disponibles") */
  label: string;
  /** Texto secundario opcional (ej: "1 crédito = 1 página") */
  hint?: string;
}

export function CreditsBanner({ icon, value, label, hint }: CreditsBannerProps) {
  return (
    <Card className="flex items-center gap-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-muted">{label}</p>
        <p className="text-3xl font-bold text-text">{value}</p>
        {hint && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
      </div>
    </Card>
  );
}
