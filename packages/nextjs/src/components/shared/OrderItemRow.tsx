"use client";

/**
 * OrderItemRow — Fila de artículo dentro de un pedido agrupado.
 *
 * Componente intermedio reutilizable para mostrar un artículo individual
 * dentro del detalle de un batch. Muestra: imagen, nombre, precio, estado
 * y opcionalmente un botón de acción (devolver, marcar entregado).
 *
 * Compone: ProductImage (intermedio) + Badge (atómico) + Button (atómico).
 * Se usa en: detalle del batch (estudiante y admin).
 */

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProductImage } from "@/components/shared/ProductImage";
import { ORDER_STATUS_MAP } from "@/lib/shop-constants";

interface OrderItemRowProps {
  name: string;
  imageUrl: string | null;
  category: string | null;
  color?: string | null;
  variantLabel?: string | null;
  pricePaid: number;
  status: "PAID" | "DELIVERED" | "RETURNED";
  /** Texto del botón de acción (si hay) */
  actionLabel?: string;
  /** Variante del botón */
  actionVariant?: "primary" | "danger" | "outline";
  /** Callback del botón */
  onAction?: () => void;
  /** Estado de carga del botón */
  actionLoading?: boolean;
  /** Desactivar el botón */
  actionDisabled?: boolean;
}

export function OrderItemRow({
  name,
  imageUrl,
  category,
  color,
  variantLabel,
  pricePaid,
  status,
  actionLabel,
  actionVariant = "outline",
  onAction,
  actionLoading,
  actionDisabled,
}: OrderItemRowProps) {
  const statusInfo = ORDER_STATUS_MAP[status] ?? ORDER_STATUS_MAP.PAID;

  return (
    <div className="flex items-center gap-4 py-3 px-4">
      {/* Imagen */}
      <div className="h-12 w-12 shrink-0 rounded-lg bg-primary/5 p-1">
        <ProductImage
          imageUrl={imageUrl}
          name={name}
          category={category}
          className="h-full w-full object-contain"
          emojiSize="md"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{name}</p>
        {(variantLabel || color) && (
          <p className="text-xs text-text-muted truncate">{variantLabel ?? color}</p>
        )}
      </div>

      {/* Precio */}
      <div className="text-sm font-semibold text-primary whitespace-nowrap">
        {pricePaid} ShopTokens
      </div>

      {/* Estado */}
      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>

      {/* Acción */}
      {onAction && actionLabel && (
        <Button
          size="sm"
          variant={actionVariant}
          onClick={onAction}
          loading={actionLoading}
          disabled={actionDisabled}
          className="shrink-0"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
