"use client";

/**
 * VariantGridItem — Card de variante para grid de admin.
 *
 * Componente intermedio que muestra una variante de producto en una
 * card compacta con: imagen, nombre, color, stock, precio, estado
 * y botones de editar/toggle activo.
 *
 * Compone: ProductImage (intermedio) + Badge (atómico) + Button (atómico).
 */

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { colorToHex } from "@/components/ui/ColorDot";
import { ProductImage } from "@/components/shared/ProductImage";

interface VariantGridItemProps {
  id: string;
  name: string;
  color: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  category: string | null;
  active: boolean;
  selected: boolean;
  toggling: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
}

export function VariantGridItem({
  name,
  color,
  price,
  stock,
  imageUrl,
  category,
  active,
  selected,
  toggling,
  onSelect,
  onEdit,
  onToggleActive,
}: VariantGridItemProps) {
  return (
    <div
      className={`relative cursor-pointer transition-all rounded-xl border bg-card p-5 ${
        selected
          ? "ring-2 ring-primary border-primary"
          : "border-border-default hover:border-primary/50"
      } ${!active ? "opacity-60" : ""}`}
      onClick={onSelect}
    >
      {/* Badge estado */}
      <div className="absolute top-2 right-2">
        <Badge variant={active ? "success" : "danger"} className="text-xs">
          {active ? "Activa" : "Inactiva"}
        </Badge>
      </div>

      {/* Imagen */}
      <div className="flex justify-center mb-3 pt-2">
        <div className="h-20 w-20">
          <ProductImage
            imageUrl={imageUrl}
            name={name}
            category={category}
            className="h-full w-full object-contain"
            emojiSize="md"
          />
        </div>
      </div>

      {/* Info */}
      <p className="text-sm font-medium text-text text-center line-clamp-2 mb-1">{name}</p>
      <div className="flex items-center justify-center gap-2 mb-2">
        <span
          className="inline-block h-3 w-3 rounded-full border border-border-default"
          style={{ backgroundColor: colorToHex(color || "default") }}
        />
        <span className="text-xs text-text-muted">{color || "—"}</span>
      </div>

      <div className="flex justify-between text-xs text-text-muted">
        <span>Stock: {stock}</span>
        <span className="font-semibold text-primary">{price} ShopTokens</span>
      </div>

      {/* Acciones rápidas */}
      <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onEdit}>
          Editar
        </Button>
        <Button
          variant={active ? "danger" : "primary"}
          size="sm"
          className="flex-1 text-xs"
          onClick={onToggleActive}
          loading={toggling}
        >
          {active ? "Desact." : "React."}
        </Button>
      </div>
    </div>
  );
}
