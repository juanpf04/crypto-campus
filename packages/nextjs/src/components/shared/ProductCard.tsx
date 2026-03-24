"use client";

/**
 * ProductCard — Card de producto para el grid del catálogo.
 *
 * Muestra imagen (o fallback por categoría), nombre del producto base,
 * fila de variantes de color (ColorSwatchRow), precio en SHPT,
 * stock y badge de categoría. Toda la card es clicable.
 *
 * Al cambiar de color, la imagen cambia a la variante seleccionada.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ProductImage } from "@/components/shared/ProductImage";
import { ColorSwatchRow } from "@/components/shared/ColorSwatchRow";
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

          {/* Variantes de color */}
          <ColorSwatchRow
            variants={variants}
            selectedId={selectedVariant.id}
            onSelect={setSelectedVariantId}
            maxVisible={6}
          />

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
