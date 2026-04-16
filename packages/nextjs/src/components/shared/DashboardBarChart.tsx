"use client";

/**
 * DashboardBarChart — Gráfico de barras reutilizable para dashboards.
 *
 * Encapsula Card + título + Recharts BarChart con tema CryptoCampus
 * (colores de CSS vars). Muestra empty state si no hay datos > 0.
 */

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/Card";

interface DashboardBarChartProps {
  title: string;
  data: { month: string; count: number }[];
  emptyMessage?: string;
  formatter?: (value: number) => string;
  barColor?: string;
  heightClassName?: string;
}

export function DashboardBarChart({
  title,
  data,
  emptyMessage = "No hay datos",
  formatter = (v) => `${v}`,
  barColor = "var(--color-primary)",
  heightClassName = "h-56",
}: DashboardBarChartProps) {
  const hasData = data.some((m) => m.count > 0);

  return (
    <Card className="space-y-3">
      <h3 className="font-medium text-text">{title}</h3>
      {hasData ? (
        <div className={heightClassName}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-default)", borderRadius: 8, fontSize: 13 }}
                labelStyle={{ color: "var(--color-text)" }}
                itemStyle={{ color: barColor }}
                formatter={(value) => [formatter(Number(value)), ""]}
              />
              <Bar dataKey="count" fill={barColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-text-muted py-8 text-center">{emptyMessage}</p>
      )}
    </Card>
  );
}
