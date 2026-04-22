"use client";

/**
 * ProductDetailPanel — Panel de información de un producto.
 *
 * Columna derecha de la vista de detalle: categoría, nombre, descripción,
 * selector de color, precio, stock, cantidad, botones carrito/comprar.
 * Todo lo visual sin side-effects: page superior maneja fetches.
 */

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { DetailField } from "@/components/shared/DetailField";
import { ColorSwatchRow } from "@/components/shared/ColorSwatchRow";

export interface ProductDetailVariant {
  id: string;
  name: string;
  color: string;
  variantLabel: string | null;
  price: number;
  stock: number;
  category: string | null;
  imageUrl: string | null;
}

export interface ProductDetailGroup {
  name: string;
  description: string | null;
  variants: ProductDetailVariant[];
}

interface ProductDetailPanelProps {
  group: ProductDetailGroup;
  selectedVariant: ProductDetailVariant;
  selectedVariantId: string;
  onSelectVariant: (variantId: string) => void;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
  addingToCart?: boolean;
}

export function ProductDetailPanel({
  group,
  selectedVariant,
  selectedVariantId,
  onSelectVariant,
  quantity,
  onQuantityChange,
  onAddToCart,
  onBuyNow,
  addingToCart = false,
}: ProductDetailPanelProps) {
  const isOutOfStock = selectedVariant.stock <= 0;
  const totalPrice = selectedVariant.price * quantity;

  return (
    <Card className="space-y-5">
      {selectedVariant.category && <Badge variant="neutral">{selectedVariant.category}</Badge>}

      <h1 className="text-2xl font-bold text-text">{group.name}</h1>

      {group.description && (
        <p className="text-text-muted leading-relaxed">{group.description}</p>
      )}

      {group.variants.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-text">
            Color: <span className="text-text-muted">{selectedVariant.variantLabel ?? selectedVariant.color}</span>
          </p>
          <ColorSwatchRow
            variants={group.variants}
            selectedId={selectedVariantId}
            onSelect={onSelectVariant}
            size="md"
          />
        </div>
      )}

      <div className="border-t border-border-default" />

      <div className="space-y-3">
        <DetailField
          label="Precio unitario"
          value={
            <span className="text-xl font-bold text-primary">{selectedVariant.price} ShopTokens</span>
          }
        />
        <DetailField
          label="Disponibilidad"
          value={
            isOutOfStock ? (
              <Badge variant="danger">Agotado</Badge>
            ) : (
              <span className="text-text">{selectedVariant.stock} unidades disponibles</span>
            )
          }
        />
      </div>

      <div className="border-t border-border-default" />

      {!isOutOfStock && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-text">Cantidad</p>
          <div className="flex items-center gap-4">
            <QuantitySelector
              value={quantity}
              onChange={onQuantityChange}
              min={1}
              max={selectedVariant.stock}
              size="md"
            />
            {quantity > 1 && (
              <span className="text-sm text-text-muted">
                Total: <span className="font-semibold text-primary">{totalPrice} ShopTokens</span>
              </span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3 pt-2">
        <Button
          onClick={onAddToCart}
          disabled={isOutOfStock || addingToCart}
          loading={addingToCart}
          className="w-full"
          variant="secondary"
        >
          {isOutOfStock ? "Sin stock" : "Añadir al carrito"}
        </Button>

        <Button
          onClick={onBuyNow}
          disabled={isOutOfStock}
          className="w-full"
        >
          {isOutOfStock ? "Sin stock" : "Comprar ahora"}
        </Button>
      </div>
    </Card>
  );
}
