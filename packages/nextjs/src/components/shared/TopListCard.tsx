"use client";

/**
 * TopListCard — Card con lista numerada (o no) de ítems destacados.
 *
 * Uso típico: "Top ítems más prestados", "Top asignaturas", etc.
 * Cada ítem muestra título + subtítulo opcional + stat a la derecha.
 */

import { Card } from "@/components/ui/Card";

export interface TopListItem {
  title: string;
  subtitle?: string;
  stat: string | number;
}

interface TopListCardProps {
  title: string;
  items: TopListItem[];
  emptyMessage?: string;
  statColor?: string;
  numbered?: boolean;
}

export function TopListCard({
  title,
  items,
  emptyMessage = "Sin datos",
  statColor = "text-primary",
  numbered = true,
}: TopListCardProps) {
  return (
    <Card className="space-y-3">
      <h3 className="font-medium text-text">{title}</h3>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              {numbered && (
                <span className="text-sm font-bold text-text-muted w-5 text-right">{i + 1}.</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text truncate">{item.title}</p>
                {item.subtitle && <p className="text-xs text-text-muted truncate">{item.subtitle}</p>}
              </div>
              <span className={`text-sm font-semibold ${statColor} shrink-0`}>{item.stat}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted py-4 text-center">{emptyMessage}</p>
      )}
    </Card>
  );
}
