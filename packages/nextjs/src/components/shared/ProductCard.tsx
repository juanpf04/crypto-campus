"use client";

/**
 * ProductCard — Card de producto para el grid del catálogo.
 *
 * Muestra imagen (o fallback por categoría), nombre del producto base,
 * fila de variantes de color (ColorSwatchRow), precio en ShopTokens,
 * stock y badge de categoría. Toda la card es clicable (navega al detalle).
 *
 * Botón "Añadir al carrito" stop-propaga el click para no navegar. La
 * lógica de añadir al carrito (fetch, toast, abrir drawer) se delega al
 * padre vía `onAddToCart` — la molécula no hace side-effects.
 *
 * Props opcionales:
 * - onAddToCart(variantId): callback asíncrono. Si se provee, se muestra
 *   el botón "Añadir al carrito". Se espera la promesa para controlar el
 *   estado de loading.
 * - addToCartHref(variantId): alternativa a onAddToCart para contextos
 *   sin sesión (preview público) — navega a la URL indicada.
 * - showAddToCart: si se muestra el botón + (default true)
 * - adminMode: si true, no muestra botón de carrito (para vista admin)
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { icons } from "@/components/ui/icons";
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
  /** URL base para el Link (default: /student/shop/) */
  linkBase?: string;
  /** Callback al añadir al carrito (1 unidad de la variante seleccionada).
   *  Puede ser async — el componente espera la promesa para gestionar el
   *  estado de loading del botón. */
  onAddToCart?: (variantId: string) => void | Promise<void>;
  /** Mostrar botón + de carrito (default true) */
  showAddToCart?: boolean;
  /** Si se pasa, el botón de carrito es un Link a esta URL en vez de hacer POST */
  addToCartHref?: (variantId: string) => string;
  /** Modo admin: muestra botones de editar/eliminar en vez de carrito */
  adminMode?: boolean;
  /** Si el producto está activo (solo relevante en adminMode) */
  active?: boolean;
  /** Callbacks admin */
  onEdit?: (variantId: string) => void;
  onToggleActive?: (variantId: string, currentlyActive: boolean) => void;
}

export function ProductCard({
  name,
  minPrice,
  maxPrice,
  totalStock,
  category,
  variants,
  linkBase = "/student/shop/",
  onAddToCart,
  showAddToCart = true,
  addToCartHref,
  adminMode = false,
  active = true,
  onToggleActive,
}: ProductCardProps) {
  const router = useRouter();
  const [selectedVariantId, setSelectedVariantId] = useState<string>(variants[0]?.id ?? "");
  const [adding, setAdding] = useState(false);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? variants[0],
    [selectedVariantId, variants],
  );

  const isOutOfStock = totalStock <= 0;
  const priceLabel = minPrice === maxPrice ? `${minPrice} ShopTokens` : `${minPrice}-${maxPrice} ShopTokens`;

  if (!selectedVariant) return null;

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (adding || isOutOfStock || !onAddToCart) return;

    setAdding(true);
    try {
      await onAddToCart(selectedVariant.id);
    } finally {
      setAdding(false);
    }
  }

  function handleToggleActive(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onToggleActive?.(selectedVariant.id, active);
  }

  return (
    <Link href={`${linkBase}${selectedVariant.id}`} className="group block">
      <Card className={`relative h-full flex flex-col overflow-hidden p-0 transition-colors hover:border-primary/50 ${!active ? "opacity-60" : ""}`}>
        {/* Badge inactivo */}
        {!active && adminMode && (
          <div className="absolute top-2 left-2 z-10">
            <Badge variant="danger">Inactivo</Badge>
          </div>
        )}

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
        <div className="flex flex-col flex-1 space-y-2 p-4">
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

          <div className="mt-auto flex items-center justify-between">
            <span className="text-lg font-bold text-primary">{priceLabel}</span>
            {isOutOfStock ? (
              <Badge variant="danger">Agotado</Badge>
            ) : (
              <span className="text-xs text-text-muted">Stock: {totalStock}</span>
            )}
          </div>

          {/* Botones de acción */}
          {!adminMode && showAddToCart && !isOutOfStock && (addToCartHref || onAddToCart) && (
            addToCartHref ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(addToCartHref(selectedVariant.id));
                }}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer [&_svg]:h-4 [&_svg]:w-4"
              >
                {icons.cart}
                Añadir al carrito
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={adding}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4"
              >
                {adding ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    {icons.cart}
                    Añadir al carrito
                  </>
                )}
              </button>
            )
          )}

          {/* Botones admin */}
          {adminMode && (
            <div className="flex gap-2 mt-auto">
              <button
                type="button"
                onClick={handleToggleActive}
                className={`flex-1 flex items-center justify-center gap-1 rounded-lg border py-2 text-sm transition-colors cursor-pointer [&_svg]:h-3.5 [&_svg]:w-3.5 ${
                  active
                    ? "border-danger/30 text-danger hover:bg-danger/5"
                    : "border-success/30 text-success hover:bg-success/5"
                }`}
              >
                {active ? (
                  <>
                    {icons.close}
                    Desactivar producto
                  </>
                ) : (
                  <>
                    {icons.check}
                    Reactivar producto
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <LinkArrow variant="fade" size="sm" className="right-3 top-3" />
      </Card>
    </Link>
  );
}
