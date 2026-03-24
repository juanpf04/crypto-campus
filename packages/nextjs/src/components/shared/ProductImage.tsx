"use client";

/**
 * ProductImage — Imagen de producto con fallback por categoría.
 *
 * Intenta cargar la imagen desde imageUrl. Si falla o no existe,
 * muestra el emoji de la categoría (o un emoji genérico de tienda).
 *
 * Reutilizable en: ProductCard, detalle de producto, detalle de pedido.
 */

import { useState } from "react";
import { CATEGORY_FALLBACKS, DEFAULT_PRODUCT_EMOJI } from "@/lib/shop-constants";

interface ProductImageProps {
  /** URL de la imagen del producto */
  imageUrl: string | null;
  /** Nombre del producto (para el alt) */
  name: string;
  /** Categoría del producto (para el fallback) */
  category: string | null;
  /** Tamaño del emoji de fallback */
  emojiSize?: "md" | "lg" | "xl";
  /** Clase CSS adicional para la imagen */
  className?: string;
}

const emojiSizeMap = {
  md: "text-5xl",
  lg: "text-7xl",
  xl: "text-8xl",
};

export function ProductImage({
  imageUrl,
  name,
  category,
  emojiSize = "lg",
  className = "max-h-[200px] w-auto object-contain",
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const fallbackEmoji = CATEGORY_FALLBACKS[category ?? ""] ?? DEFAULT_PRODUCT_EMOJI;

  if (!imageUrl || failed) {
    return <span className={emojiSizeMap[emojiSize]}>{fallbackEmoji}</span>;
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
