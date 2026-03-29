"use client";

/**
 * FloatingActionBar — Barra de acción flotante en la parte inferior.
 *
 * Componente atómico reutilizable que aparece fija abajo cuando hay
 * una selección activa. Usada para acciones en lote: devolver artículos,
 * eliminar selección, etc.
 *
 * Props:
 * - visible: controla si se muestra
 * - children: contenido libre (botones, texto, etc.)
 */

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FloatingActionBarProps {
  visible: boolean;
  children: ReactNode;
  className?: string;
}

export function FloatingActionBar({ visible, children, className }: FloatingActionBarProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 transition-transform duration-300 ease-in-out",
        visible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className={cn(
        "mx-auto max-w-3xl px-4 pb-4",
        className,
      )}>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border-default bg-card px-5 py-3 shadow-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
