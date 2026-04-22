"use client";

/**
 * CartItemList — Lista de items del carrito (vista full-page).
 *
 * Compone Card + ProductImage + QuantitySelector + icon button de borrar.
 * No hace fetches: recibe los items y callbacks del padre.
 */

import { Card } from "@/components/ui/Card";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { icons } from "@/components/ui/icons";
import { ProductImage } from "@/components/shared/ProductImage";

export interface CartItemListItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  subtotal: number;
  imageUrl: string | null;
  category: string | null;
  color: string | null;
  variantLabel: string | null;
}

interface CartItemListProps {
  items: CartItemListItem[];
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onRemove: (itemId: string) => void;
}

export function CartItemList({ items, onUpdateQuantity, onRemove }: CartItemListProps) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.id} className="flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 rounded-lg bg-primary/5 p-2">
            <ProductImage
              imageUrl={item.imageUrl}
              name={item.name}
              category={item.category}
              className="h-full w-full object-contain"
              emojiSize="md"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text line-clamp-2">{item.name}</p>
            <p className="text-sm text-text-muted">
              {item.variantLabel ?? item.color ?? ""} · {item.price} ShopTokens/ud.
            </p>
          </div>

          <QuantitySelector
            value={item.quantity}
            onChange={(q) => onUpdateQuantity(item.id, q)}
            min={1}
            max={item.stock}
            size="sm"
          />

          <div className="w-24 text-right">
            <p className="font-semibold text-text">{item.subtotal} ShopTokens</p>
          </div>

          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="shrink-0 rounded-md p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
            aria-label="Eliminar producto"
          >
            {icons.trash}
          </button>
        </Card>
      ))}
    </div>
  );
}
