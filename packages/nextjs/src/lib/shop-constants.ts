/**
 * shop-constants.ts — Constantes compartidas del módulo de tienda.
 *
 * Centraliza mappings que se usan en múltiples componentes y páginas
 * para evitar duplicación.
 */

import type { BadgeVariant } from "@/components/ui/Badge";

/** Emojis de fallback por categoría de producto (cuando no hay imagen) */
export const CATEGORY_FALLBACKS: Record<string, string> = {
  "Papelería": "📝",
  "Ropa": "👕",
  "Accesorios": "🎒",
  "Tecnología": "💻",
};

/** Emoji por defecto cuando la categoría no tiene fallback */
export const DEFAULT_PRODUCT_EMOJI = "🛍️";

/** Mapeo de estados de pedido a texto y variante de Badge */
export const ORDER_STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  PAID: { label: "Pagado", variant: "warning" },
  DELIVERED: { label: "Entregado", variant: "success" },
  RETURNED: { label: "Devuelto", variant: "neutral" },
};
