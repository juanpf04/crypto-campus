"use client";

/**
 * VariantDetailCard — Card destacada con info de la variante seleccionada
 * dentro de la vista admin de detalle de producto.
 *
 * Incluye los 3-4 datos principales (color, precio, stock, etiqueta) y los
 * botones de editar / desactivar-reactivar la variante.
 */

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { colorToHex } from "@/components/ui/ColorDot";

interface VariantDetailCardProps {
  productId: number;
  name: string;
  color: string;
  variantLabel: string | null;
  price: number;
  stock: number;
  active: boolean;
  toggling: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
}

export function VariantDetailCard({
  productId,
  name,
  color,
  variantLabel,
  price,
  stock,
  active,
  toggling,
  onEdit,
  onToggleActive,
}: VariantDetailCardProps) {
  return (
    <Card className={active ? "bg-primary/5 border-primary/20" : "bg-danger/5 border-danger/20"}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-text">{name}</h3>
          <Badge variant={active ? "success" : "danger"}>
            {active ? "Activa" : "Inactiva"}
          </Badge>
        </div>
        <Badge variant="neutral">#{productId}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 mb-4">
        <div>
          <p className="text-xs text-text-muted">Color</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-block h-4 w-4 rounded-full border border-border-default"
              style={{ backgroundColor: colorToHex(color || "default") }}
            />
            <span className="text-sm font-medium text-text">{color || "—"}</span>
          </div>
        </div>
        <div>
          <p className="text-xs text-text-muted">Precio</p>
          <p className="text-sm font-semibold text-primary mt-1">{price} ShopTokens</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Stock</p>
          <p className="text-sm font-semibold text-text mt-1">{stock} uds.</p>
        </div>
        {variantLabel && (
          <div>
            <p className="text-xs text-text-muted">Etiqueta</p>
            <p className="text-sm font-medium text-text mt-1">{variantLabel}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
          Editar variante
        </Button>
        <Button
          variant={active ? "danger" : "success"}
          size="sm"
          className="flex-1"
          onClick={onToggleActive}
          loading={toggling}
        >
          {active ? "Desactivar variante" : "Reactivar variante"}
        </Button>
      </div>
    </Card>
  );
}
