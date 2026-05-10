"use client";

/**
 * RewardCard — Tarjeta de recompensa para el catálogo del estudiante.
 * Muestra icono de categoría, nombre, coste, stock y botón de canjear.
 */

import type { RewardCategory } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RewardCategoryIcon, getCategoryLabel } from "@/components/shared/RewardCategoryIcon";

interface RewardCardProps {
  name: string;
  description: string | null;
  badgeCost: number;
  /** Stock restante de la recompensa. 0 = ilimitada. La acción de canje ya
   *  decrementa este campo, así que es el "remaining" directo — no hace falta
   *  restar nada. */
  supply: number;
  category: RewardCategory;
  /** Si se pasa, muestra los tokens que posee el alumno; si no, se omite. */
  studentBadgeCount?: number;
  /** Si se pasa, muestra la asignatura (útil fuera de la vista ya filtrada). */
  subjectName?: string;
  onRedeem?: () => void;
  redeeming?: boolean;
}

export function RewardCard({
  name,
  description,
  badgeCost,
  supply,
  category,
  studentBadgeCount,
  subjectName,
  onRedeem,
  redeeming,
}: RewardCardProps) {
  const remaining = supply === 0 ? Infinity : supply;
  const canRedeem = studentBadgeCount !== undefined && studentBadgeCount >= badgeCost && remaining > 0;

  return (
    <Card className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-start gap-3">
        <RewardCategoryIcon category={category} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-text truncate">{name}</h3>
          <p className="text-xs text-text-muted mt-0.5">{getCategoryLabel(category)}</p>
        </div>
      </div>

      {description && (
        <p className="text-sm text-text-muted line-clamp-2">{description}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="info">{badgeCost} insignia{badgeCost !== 1 ? "s" : ""}</Badge>
        {supply === 0 ? (
          <Badge variant="neutral">Ilimitado</Badge>
        ) : remaining > 0 ? (
          <Badge variant="success">{remaining} disponible{remaining !== 1 ? "s" : ""}</Badge>
        ) : (
          <Badge variant="danger">Agotado</Badge>
        )}
        {subjectName && <Badge variant="neutral">{subjectName}</Badge>}
      </div>

      {onRedeem && (
        <Button
          size="sm"
          className="mt-auto w-full"
          onClick={onRedeem}
          loading={redeeming}
          disabled={!canRedeem}
        >
          {canRedeem ? "Canjear" : remaining <= 0 ? "Agotado" : "Insignias insuficientes"}
        </Button>
      )}
    </Card>
  );
}
