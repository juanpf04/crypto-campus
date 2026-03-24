"use client";

/**
 * QuantitySelector — Selector de cantidad con botones +/-.
 *
 * Componente atómico reutilizable para seleccionar cantidades numéricas.
 * Se usa en: detalle de producto, carrito, y cualquier vista que
 * necesite un input numérico con incremento/decremento.
 *
 * Props:
 * - value: cantidad actual
 * - onChange: callback al cambiar la cantidad
 * - min: mínimo permitido (default 1)
 * - max: máximo permitido (default sin límite)
 * - size: "sm" | "md" | "lg" para distintos contextos
 * - disabled: deshabilita todo el selector
 */

import { cn } from "@/lib/utils";

type SelectorSize = "sm" | "md" | "lg";

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: SelectorSize;
  disabled?: boolean;
  className?: string;
}

const sizeStyles: Record<SelectorSize, { button: string; display: string }> = {
  sm: {
    button: "h-7 w-7 text-sm",
    display: "w-8 text-sm",
  },
  md: {
    button: "h-9 w-9 text-base",
    display: "w-12 text-base",
  },
  lg: {
    button: "h-11 w-11 text-lg",
    display: "w-14 text-lg",
  },
};

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max,
  size = "md",
  disabled = false,
  className,
}: QuantitySelectorProps) {
  const styles = sizeStyles[size];
  const canDecrement = value > min && !disabled;
  const canIncrement = (max === undefined || value < max) && !disabled;

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      {/* Botón decrementar */}
      <button
        type="button"
        onClick={() => canDecrement && onChange(value - 1)}
        disabled={!canDecrement}
        className={cn(
          "inline-flex items-center justify-center rounded-lg border border-border-default",
          "font-medium transition-colors cursor-pointer",
          "hover:bg-primary/10 hover:border-primary/50 hover:text-primary",
          "disabled:pointer-events-none disabled:opacity-40",
          styles.button,
        )}
        aria-label="Reducir cantidad"
      >
        &minus;
      </button>

      {/* Valor actual */}
      <span
        className={cn(
          "text-center font-semibold text-text tabular-nums select-none",
          styles.display,
        )}
      >
        {value}
      </span>

      {/* Botón incrementar */}
      <button
        type="button"
        onClick={() => canIncrement && onChange(value + 1)}
        disabled={!canIncrement}
        className={cn(
          "inline-flex items-center justify-center rounded-lg border border-border-default",
          "font-medium transition-colors cursor-pointer",
          "hover:bg-primary/10 hover:border-primary/50 hover:text-primary",
          "disabled:pointer-events-none disabled:opacity-40",
          styles.button,
        )}
        aria-label="Aumentar cantidad"
      >
        +
      </button>
    </div>
  );
}
