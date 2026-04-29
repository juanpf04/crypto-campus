"use client";

/**
 * ColorDot — Círculo de color clicable.
 *
 * Componente atómico que representa una variante de color.
 * Al hacer clic, selecciona esa variante. Muestra un anillo
 * cuando está seleccionado.
 *
 * Reutilizable en: ProductCard, detalle de producto, cualquier
 * selector de color futuro.
 */

import { cn } from "@/lib/utils";

/** Mapeo de nombres de color en español a valores hex */
const COLOR_MAP: Record<string, string> = {
  blanco: "#f3f4f6",
  blanca: "#f3f4f6",
  negra: "#111827",
  negro: "#111827",
  roja: "#dc2626",
  rojo: "#dc2626",
  azul: "#1d4ed8",
  "azul-marino": "#1e3a5f",
  dorado: "#b45309",
  purpura: "#7e22ce",
  granate: "#7f1d1d",
  gris: "#6b7280",
  "gris-vigore": "#9ca3af",
  aventura: "#4b5563",
  nogal: "#78350f",
  plomo: "#52525b",
  rosa: "#ec4899",
  "nature-blanca": "#e5e7eb",
  "cisne-trazo": "#d1d5db",
  letras: "#a3a3a3",
  verde: "#16a34a",
};

const DEFAULT_COLOR = "#9ca3af";

interface ColorDotProps {
  /** Nombre del color (se mapea a hex automáticamente) */
  color: string;
  /** Si está seleccionado, muestra anillo */
  selected?: boolean;
  /** Callback al hacer clic */
  onClick?: (e: React.MouseEvent) => void;
  /** Tooltip (nombre del color o etiqueta personalizada) */
  label?: string;
  /** Tamaño del círculo */
  size?: "sm" | "md";
}

export function ColorDot({ color, selected = false, onClick, label, size = "sm" }: ColorDotProps) {
  const hex = COLOR_MAP[color.toLowerCase()] ?? DEFAULT_COLOR;
  const sizeClass = size === "sm" ? "h-5 w-5" : "h-7 w-7";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.(e);
      }}
      aria-label={`Color ${label ?? color}`}
      title={label ?? color}
      className={cn(
        "rounded-full border transition-all",
        sizeClass,
        selected
          ? "border-text ring-2 ring-offset-1 ring-primary"
          : "border-border-swatch hover:border-text/50",
      )}
      style={{ backgroundColor: hex }}
    />
  );
}

/** Convierte un nombre de color a su hex. Exportado para uso externo. */
export function colorToHex(color: string): string {
  return COLOR_MAP[color.toLowerCase()] ?? DEFAULT_COLOR;
}
