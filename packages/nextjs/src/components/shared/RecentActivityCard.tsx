"use client";

/**
 * RecentActivityCard — Card con lista de actividad reciente.
 *
 * Cada fila muestra título + subtítulo + (opcional) StatusBadge + fecha corta.
 * Uso típico: "Actividad reciente", "Últimos préstamos", "Últimos pedidos".
 */

import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatShortDate } from "@/lib/formatters";

export interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  status?: string;
  date: string; // ISO
}

interface RecentActivityCardProps {
  title: string;
  items: ActivityItem[];
  emptyMessage?: string;
  showStatus?: boolean;
}

export function RecentActivityCard({
  title,
  items,
  emptyMessage = "Sin actividad reciente",
  showStatus = true,
}: RecentActivityCardProps) {
  return (
    <Card className="space-y-3">
      <h3 className="font-medium text-text">{title}</h3>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-1.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text truncate">{item.title}</p>
                <p className="text-xs text-text-muted truncate">{item.subtitle}</p>
              </div>
              {showStatus && item.status && <StatusBadge status={item.status} />}
              <span className="text-xs text-text-muted shrink-0">{formatShortDate(item.date)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted py-4 text-center">{emptyMessage}</p>
      )}
    </Card>
  );
}
