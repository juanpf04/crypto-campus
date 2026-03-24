"use client";

/**
 * ProductCard — Card de producto para el grid del catálogo.
 *
 * Muestra imagen (o fallback por categoría), nombre, precio en SHPT,
 * stock restante y badge de categoría. Toda la card es clicable.
 * Incluye la flecha ↗ indicando que es navegable.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ProductImage } from "@/components/shared/ProductImage";
import { LinkArrow } from "@/components/shared/LinkArrow";

interface ProductVariant {
  id: string;
  name: string;
  color: string;
  variantLabel: string | null;
  price: number;
  stock: number;
  imageUrl: string | null;
  category: string | null;
}

interface ProductCardProps {
  groupKey: string;
  name: string;
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  category: string | null;
  variants: ProductVariant[];
}

function colorToSwatch(color: string): string {
  const map: Record<string, string> = {
    blanco: "#f3f4f6",
    negra: "#111827",
    negro: "#111827",
    roja: "#dc2626",
    rojo: "#dc2626",
    azul: "#1d4ed8",
    dorado: "#b45309",
    purpura: "#7e22ce",
    granate: "#7f1d1d",
    gris: "#6b7280",
    "gris-vigore": "#9ca3af",
    aventura: "#4b5563",
    default: "#9ca3af",
  };

  return map[color] ?? map.default;
}

export function ProductCard({ groupKey, name, minPrice, maxPrice, totalStock, category, variants }: ProductCardProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(variants[0]?.id ?? "");

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? variants[0],
    [selectedVariantId, variants],
  );

  const isOutOfStock = totalStock <= 0;
  const priceLabel = minPrice === maxPrice ? `${minPrice} SHPT` : `${minPrice}-${maxPrice} SHPT`;

  if (!selectedVariant) return null;

  return (
    <Link href={`/dashboard/student/shop/${selectedVariant.id}`} className="group block">
      <Card className="relative h-full overflow-hidden p-0 transition-colors hover:border-primary/50">
        {/* Imagen o fallback */}
        <div className="flex h-40 items-center justify-center bg-primary/5">
          <ProductImage
            imageUrl={selectedVariant.imageUrl}
            name={selectedVariant.name}
            category={selectedVariant.category}
            emojiSize="md"
            className="h-full w-full object-contain p-4"
          />
        </div>

        {/* Info del producto */}
        <div className="space-y-2 p-4">
          {category && (
            <Badge variant="neutral">{category}</Badge>
          )}

          <h3 className="font-semibold text-text line-clamp-2 leading-tight">
            {name}
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            {variants.map((variant) => {
              const selected = variant.id === selectedVariant.id;
              return (
                <button
                  key={`${groupKey}-${variant.id}`}
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedVariantId(variant.id);
                  }}
                  aria-label={`Color ${variant.color}`}
                  title={variant.variantLabel ?? variant.color}
                  className={`h-5 w-5 rounded-full border ${selected ? "border-text" : "border-border-default"}`}
                  style={{ backgroundColor: colorToSwatch(variant.color) }}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-primary">{priceLabel}</span>
            {isOutOfStock ? (
              <Badge variant="danger">Agotado</Badge>
            ) : (
              <span className="text-xs text-text-muted">Stock: {totalStock}</span>
            )}
          </div>
        </div>

        <LinkArrow variant="fade" size="sm" className="right-3 top-3" />
      </Card>
    </Link>
  );
}
