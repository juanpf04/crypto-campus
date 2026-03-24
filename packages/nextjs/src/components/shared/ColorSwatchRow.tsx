"use client";

/**
 * ColorSwatchRow — Fila de círculos de color con overflow "+N".
 *
 * Compone múltiples ColorDot. Si hay más variantes que maxVisible,
 * muestra los primeros y un indicador "+N más".
 *
 * Reutilizable en: ProductCard (catálogo), ProductDetail, cualquier
 * selector de variantes.
 */

import { ColorDot } from "@/components/ui/ColorDot";

interface ColorVariant {
  id: string;
  color: string;
  variantLabel?: string | null;
}

interface ColorSwatchRowProps {
  /** Lista de variantes con color */
  variants: ColorVariant[];
  /** ID de la variante seleccionada */
  selectedId: string;
  /** Callback al seleccionar una variante */
  onSelect: (id: string) => void;
  /** Máximo de círculos visibles antes de mostrar "+N" (0 = sin límite) */
  maxVisible?: number;
  /** Tamaño de los círculos */
  size?: "sm" | "md";
}

export function ColorSwatchRow({
  variants,
  selectedId,
  onSelect,
  maxVisible = 0,
  size = "sm",
}: ColorSwatchRowProps) {
  if (variants.length <= 1) return null;

  const visibleVariants = maxVisible > 0 ? variants.slice(0, maxVisible) : variants;
  const overflow = maxVisible > 0 ? variants.length - maxVisible : 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visibleVariants.map((variant) => (
        <ColorDot
          key={variant.id}
          color={variant.color}
          selected={variant.id === selectedId}
          onClick={() => onSelect(variant.id)}
          label={variant.variantLabel ?? variant.color}
          size={size}
        />
      ))}
      {overflow > 0 && (
        <span className="text-xs text-text-muted ml-0.5">+{overflow}</span>
      )}
    </div>
  );
}
