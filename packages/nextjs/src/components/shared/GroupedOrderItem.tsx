"use client";

/**
 * GroupedOrderItem — Fila limpia de artículo agrupado en un ticket.
 *
 * Diseño tipo recibo: checkbox (si devolvible) + imagen + nombre + cantidad +
 * precio + estado + flecha de navegación.
 * Sin botones de acción — las acciones se gestionan desde la barra flotante.
 *
 * Compone: ProductImage (intermedio) + Badge (atómico) + LinkArrow (intermedio).
 */

import { Badge } from "@/components/ui/Badge";
import { ProductImage } from "@/components/shared/ProductImage";
import { LinkArrow } from "@/components/shared/LinkArrow";
import { ORDER_STATUS_MAP } from "@/lib/shop-constants";

export interface GroupedItem {
  /** IDs de Prisma de los orders agrupados */
  orderIds: string[];
  /** ID de Prisma del producto (para navegación al detalle) */
  productPrismaId: string | null;
  name: string;
  imageUrl: string | null;
  category: string | null;
  color: string | null;
  variantLabel: string | null;
  pricePaid: number;
  quantity: number;
  status: "PAID" | "DELIVERED" | "RETURNED";
  /** Cuántos se pueden devolver (entregados y dentro de ventana) */
  returnableCount: number;
  /** Cuántos están en PAID (para entregar — admin) */
  deliverableCount: number;
}

interface GroupedOrderItemProps {
  item: GroupedItem;
  /** ¿Está seleccionado el checkbox? */
  selected?: boolean;
  /** Cuántos de este grupo están seleccionados para devolver */
  selectedCount?: number;
  /** Callback al cambiar selección */
  onSelectChange?: (selected: boolean) => void;
  /** Callback al cambiar cantidad seleccionada (para grupos con >1) */
  onCountChange?: (count: number) => void;
  /** Callback al clicar la fila para navegar al detalle del producto */
  onNavigate?: () => void;
  /** Mostrar checkbox (solo si hay algo devolvible o entregable) */
  showCheckbox?: boolean;
}

export function GroupedOrderItem({
  item,
  selected = false,
  selectedCount = 0,
  onSelectChange,
  onCountChange,
  onNavigate,
  showCheckbox = false,
}: GroupedOrderItemProps) {
  const statusInfo = ORDER_STATUS_MAP[item.status] ?? ORDER_STATUS_MAP.PAID;

  return (
    <div
      className={`flex items-center gap-3 py-3 px-4 transition-colors ${onNavigate ? "cursor-pointer hover:bg-primary/5" : ""} ${selected ? "bg-primary/5" : ""}`}
      onClick={onNavigate}
    >
      {/* Checkbox */}
      {showCheckbox && (
        <div onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelectChange?.(e.target.checked)}
            className="h-4 w-4 rounded border-border-default text-primary focus:ring-primary cursor-pointer accent-[var(--primary)]"
          />
        </div>
      )}

      {/* Imagen */}
      <div className="h-11 w-11 shrink-0 rounded-lg bg-primary/5 p-1">
        <ProductImage
          imageUrl={item.imageUrl}
          name={item.name}
          category={item.category}
          className="h-full w-full object-contain"
          emojiSize="md"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{item.name}</p>
        {(item.variantLabel || item.color) && (
          <p className="text-xs text-text-muted truncate">{item.variantLabel ?? item.color}</p>
        )}
      </div>

      {/* Cantidad */}
      {item.quantity > 1 && (
        <span className="text-sm text-text-muted shrink-0">×{item.quantity}</span>
      )}

      {/* Precio */}
      <div className="text-right shrink-0 min-w-[80px]">
        <p className="text-sm font-semibold text-primary">
          {item.pricePaid * item.quantity} ShopTokens
        </p>
        {item.quantity > 1 && (
          <p className="text-xs text-text-muted">{item.pricePaid} c/u</p>
        )}
      </div>

      {/* Estado */}
      <Badge variant={statusInfo.variant} className="shrink-0">{statusInfo.label}</Badge>

      {/* Selector de cantidad (solo si seleccionado y >1 devolvible) */}
      {selected && item.returnableCount > 1 && onCountChange && (
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={selectedCount}
            onChange={(e) => onCountChange(Number(e.target.value))}
            className="rounded border border-border-default bg-card px-1.5 py-1 text-xs text-text w-12"
          >
            {Array.from({ length: item.returnableCount }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      )}

      {/* Flecha de navegación — siempre visible */}
      <LinkArrow variant="static" size="sm" className="relative right-auto top-auto shrink-0" />
    </div>
  );
}

/**
 * Agrupa artículos por producto+estado para el detalle del ticket.
 * Solo agrupa si tienen el mismo productName + color + status.
 */
export function groupOrderItems(items: {
  id: string;
  productId?: string;
  pricePaid: number;
  status: "PAID" | "DELIVERED" | "RETURNED";
  deliveryDate: string | null;
  product: {
    id?: string;
    name: string;
    imageUrl: string | null;
    category: string | null;
    color: string | null;
    variantLabel: string | null;
  };
}[]): GroupedItem[] {
  const groups = new Map<string, GroupedItem>();

  for (const item of items) {
    const key = `${item.product.name}|${item.product.color ?? ""}|${item.status}`;

    if (!groups.has(key)) {
      const withinWindow = item.status === "DELIVERED" && item.deliveryDate
        ? (Date.now() - new Date(item.deliveryDate).getTime()) < 30 * 24 * 60 * 60 * 1000
        : false;

      groups.set(key, {
        orderIds: [item.id],
        productPrismaId: item.productId ?? item.product.id ?? null,
        name: item.product.name,
        imageUrl: item.product.imageUrl,
        category: item.product.category,
        color: item.product.color,
        variantLabel: item.product.variantLabel,
        pricePaid: item.pricePaid,
        quantity: 1,
        status: item.status,
        returnableCount: withinWindow ? 1 : 0,
        deliverableCount: item.status === "PAID" ? 1 : 0,
      });
    } else {
      const existing = groups.get(key)!;
      existing.orderIds.push(item.id);
      existing.quantity += 1;

      if (item.status === "PAID") existing.deliverableCount += 1;

      const withinWindow = item.status === "DELIVERED" && item.deliveryDate
        ? (Date.now() - new Date(item.deliveryDate).getTime()) < 30 * 24 * 60 * 60 * 1000
        : false;
      if (withinWindow) existing.returnableCount += 1;
    }
  }

  return [...groups.values()];
}
