"use client";

/**
 * DashboardBarChart — Gráfico de barras reutilizable para dashboards.
 *
 * Encapsula Card + título + Recharts BarChart con tema CryptoCampus
 * (colores de CSS vars). Muestra empty state si no hay datos > 0.
 *
 * Sustituimos `ResponsiveContainer` por un `ResizeObserver` propio para
 * evitar el warning de Recharts "width(-1) and height(-1)..." que aparece
 * cuando el contenedor todavía no se ha medido en el primer render.
 */

import { useEffect, useRef, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
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

  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDims({ width: rect.width, height: rect.height });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasData]);

  return (
    <Card className="space-y-3">
      <h3 className="font-medium text-text">{title}</h3>
      {hasData ? (
        <div ref={containerRef} className={heightClassName}>
          {dims.width > 0 && dims.height > 0 && (
            <BarChart
              width={dims.width}
              height={dims.height}
              data={data}
              margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
            >
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
          )}
        </div>
      ) : (
        <p className="text-sm text-text-muted py-8 text-center">{emptyMessage}</p>
      )}
    </Card>
  );
}
