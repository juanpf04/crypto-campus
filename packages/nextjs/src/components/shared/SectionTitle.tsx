"use client";

/**
 * Título de sección para los dashboards.
 *
 * Muestra un icono dentro de un cuadrado redondeado con fondo
 * primary/10 seguido de un texto de encabezado h2.
 * Se usaba de forma idéntica en los 4 dashboards por rol.
 */

import type { ReactNode } from "react";

interface SectionTitleProps {
  icon: ReactNode;
  children: ReactNode;
}

export function SectionTitle({ icon, children }: SectionTitleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <h2 className="text-lg font-semibold text-text">{children}</h2>
    </div>
  );
}
