"use client";

/**
 * ProductCard — Card de producto para el grid del catálogo.
 *
 * Muestra imagen (o fallback por categoría), nombre, precio en SHPT,
 * stock restante y badge de categoría. Toda la card es clicable.
 * Incluye la flecha ↗ indicando que es navegable.
 */

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ProductImage } from "@/components/shared/ProductImage";
import { LinkArrow } from "@/components/shared/LinkArrow";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string | null;
  imageUrl: string | null;
}

export function ProductCard({ id, name, price, stock, category, imageUrl }: ProductCardProps) {
  const isOutOfStock = stock <= 0;

  return (
    <Link href={`/dashboard/student/shop/${id}`} className="group block">
      <Card className="relative h-full overflow-hidden p-0 transition-colors hover:border-primary/50">
        {/* Imagen o fallback */}
        <div className="flex h-40 items-center justify-center bg-primary/5">
          <ProductImage
            imageUrl={imageUrl}
            name={name}
            category={category}
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

          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-primary">{price} SHPT</span>
            {isOutOfStock ? (
              <Badge variant="danger">Agotado</Badge>
            ) : (
              <span className="text-xs text-text-muted">Stock: {stock}</span>
            )}
          </div>
        </div>

        <LinkArrow variant="fade" size="sm" className="right-3 top-3" />
      </Card>
    </Link>
  );
}
