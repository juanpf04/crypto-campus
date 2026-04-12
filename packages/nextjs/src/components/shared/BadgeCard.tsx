"use client";

/**
 * BadgeCard — Tarjeta de insignia ganada por el estudiante.
 * Muestra nombre del badge type, asignatura y cantidad obtenida.
 */

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface BadgeCardProps {
  name: string;
  subjectName?: string;
  count: number;
}

export function BadgeCard({ name, subjectName, count }: BadgeCardProps) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-text">{name}</p>
          {subjectName && <p className="text-sm text-text-muted">{subjectName}</p>}
        </div>
        <Badge variant="info">{count}</Badge>
      </div>
    </Card>
  );
}
