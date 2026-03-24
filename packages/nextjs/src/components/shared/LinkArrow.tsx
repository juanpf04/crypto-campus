"use client";

/**
 * LinkArrow — Indicador visual de que un elemento es clicable/navegable.
 *
 * Muestra una flecha ↗ dentro de un cuadrado redondeado.
 * Tres variantes:
 * - "hover": cambia de color al hacer hover sobre el grupo padre (group-hover)
 * - "fade": invisible por defecto, aparece al hover (opacity)
 * - "static": siempre visible, sin animación
 *
 * Se posiciona absolute por defecto (el padre debe tener "relative").
 * Requiere "group" en el padre para las variantes hover/fade.
 */

import { icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface LinkArrowProps {
  /** Estilo de animación */
  variant?: "hover" | "fade" | "static";
  /** Tamaño del cuadrado */
  size?: "sm" | "md";
  /** Clase CSS adicional */
  className?: string;
}

const sizeMap = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
};

export function LinkArrow({ variant = "hover", size = "md", className }: LinkArrowProps) {
  const base = cn(
    "grid place-items-center rounded-md transition-colors",
    sizeMap[size],
  );

  const variantStyles = {
    hover: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white",
    fade: "bg-white/80 text-primary opacity-0 transition-opacity group-hover:opacity-100",
    static: "bg-primary/10 text-primary",
  };

  return (
    <div className={cn("pointer-events-none absolute right-4 top-4", base, variantStyles[variant], className)}>
      {icons.externalArrow}
    </div>
  );
}
