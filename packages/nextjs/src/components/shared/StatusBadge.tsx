"use client";

import { Badge } from "@/components/ui";

/* ───────────────────────────────────────────────────
   Mapea los estados del dominio a variantes de Badge.
   Centraliza la lógica para que las tablas no tengan
   que repetir el mapeo en cada página.
   ─────────────────────────────────────────────────── */

type LoanStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "RETURNED" | "OVERDUE";
type OrderStatus = "PAID" | "DELIVERED" | "RETURNED";
type UseRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
type GenericActive = "ACTIVE" | "INACTIVE";

type DomainStatus = LoanStatus | OrderStatus | UseRequestStatus | GenericActive;

const statusConfig: Record<DomainStatus, { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  // Préstamos
  REQUESTED: { label: "Solicitado", variant: "info" },
  APPROVED: { label: "Aprobado", variant: "success" },
  REJECTED: { label: "Rechazado", variant: "danger" },
  RETURNED: { label: "Devuelto", variant: "neutral" },
  OVERDUE: { label: "Retrasado", variant: "danger" },
  // Pedidos
  PAID: { label: "Pagado", variant: "success" },
  DELIVERED: { label: "Entregado", variant: "neutral" },
  // UseRequest
  PENDING: { label: "Pendiente", variant: "warning" },
  CANCELLED: { label: "Cancelado", variant: "neutral" },
  // Genérico
  ACTIVE: { label: "Activo", variant: "success" },
  INACTIVE: { label: "Inactivo", variant: "neutral" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as DomainStatus] ?? {
    label: status,
    variant: "neutral" as const,
  };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
