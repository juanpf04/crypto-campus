"use client";

/**
 * BatchStatusBadge — Badge de estado para pedidos agrupados.
 *
 * Componente intermedio que mapea estados de batch a colores y textos.
 * Reutilizable en: lista de pedidos del estudiante, detalle del batch,
 * lista de pedidos del admin.
 *
 * Compone: Badge (atómico).
 */

import { Badge, type BadgeVariant } from "@/components/ui/Badge";

const BATCH_STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  PAID: { label: "Pendiente", variant: "warning" },
  DELIVERED: { label: "Entregado", variant: "success" },
  PARTIALLY_DELIVERED: { label: "Parcialmente entregado", variant: "info" },
  RETURNED: { label: "Devuelto", variant: "danger" },
  PARTIALLY_RETURNED: { label: "Parcialmente devuelto", variant: "warning" },
};

interface BatchStatusBadgeProps {
  status: string;
  className?: string;
}

export function BatchStatusBadge({ status, className }: BatchStatusBadgeProps) {
  const mapped = BATCH_STATUS_MAP[status] ?? BATCH_STATUS_MAP.PAID;
  return <Badge variant={mapped.variant} className={className}>{mapped.label}</Badge>;
}
