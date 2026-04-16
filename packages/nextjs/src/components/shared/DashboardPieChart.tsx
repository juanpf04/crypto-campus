"use client";

/**
 * DashboardPieChart — Gráfico circular reutilizable para dashboards.
 *
 * Encapsula Card + título + Recharts PieChart con leyenda lateral.
 * Toma un colorMap para asignar colores por valor de `nameKey`.
 */

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/Card";

interface PieDataPoint {
  [key: string]: string | number;
}

interface DashboardPieChartProps {
  title: string;
  data: PieDataPoint[];
  dataKey: string;
  nameKey: string;
  colorMap: Record<string, string>;
  labelMap?: Record<string, string>;
  emptyMessage?: string;
  unitLabel?: string;
}

export function DashboardPieChart({
  title,
  data,
  dataKey,
  nameKey,
  colorMap,
  labelMap,
  emptyMessage = "No hay datos",
  unitLabel = "",
}: DashboardPieChartProps) {
  return (
    <Card className="space-y-3">
      <h3 className="font-medium text-text">{title}</h3>
      {data.length > 0 ? (
        <div className="flex items-center gap-6">
          <div className="h-48 w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey={dataKey}
                  nameKey={nameKey}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {data.map((entry, i) => {
                    const key = String(entry[nameKey]);
                    return <Cell key={i} fill={colorMap[key] || "#6b7280"} />;
                  })}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-default)", borderRadius: 8, fontSize: 13 }}
                  formatter={(value, _name, props) => {
                    const payload = (props as { payload: PieDataPoint }).payload;
                    const rawKey = String(payload[nameKey]);
                    const label = labelMap?.[rawKey] ?? rawKey;
                    return [`${value}${unitLabel ? ` ${unitLabel}` : ""}`, label];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 flex-1">
            {data.map((entry, i) => {
              const key = String(entry[nameKey]);
              const label = labelMap?.[key] ?? key;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: colorMap[key] || "#6b7280" }} />
                  <span className="text-sm text-text flex-1">{label}</span>
                  <span className="text-sm font-medium text-text-muted">{String(entry[dataKey])}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-muted py-8 text-center">{emptyMessage}</p>
      )}
    </Card>
  );
}
