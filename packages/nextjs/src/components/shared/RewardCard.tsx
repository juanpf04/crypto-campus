"use client";

/**
 * RewardCard — Tarjeta de recompensa para el catálogo del estudiante.
 * Muestra nombre, coste en badges, stock disponible y botón de canjear.
 */

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface RewardCardProps {
  name: string;
  description: string | null;
  badgeCost: number;
  supply: number;
  redemptionCount: number;
  subjectName: string;
  studentBadgeCount?: number;
  onRedeem?: () => void;
  redeeming?: boolean;
}

export function RewardCard({
  name,
  description,
  badgeCost,
  supply,
  redemptionCount,
  subjectName,
  studentBadgeCount,
  onRedeem,
  redeeming,
}: RewardCardProps) {
  const remaining = supply === 0 ? Infinity : supply - redemptionCount;
  const canRedeem = studentBadgeCount !== undefined && studentBadgeCount >= badgeCost && remaining > 0;

  return (
    <Card className="flex flex-col h-full p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-text">{name}</h3>
        {description && <p className="text-sm text-text-muted mt-1 line-clamp-2">{description}</p>}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="info">{badgeCost} insignias · {subjectName}</Badge>
        {supply === 0 ? (
          <Badge variant="neutral">Ilimitado</Badge>
        ) : remaining > 0 ? (
          <Badge variant="success">{remaining} disponibles</Badge>
        ) : (
          <Badge variant="danger">Agotado</Badge>
        )}
      </div>

      {studentBadgeCount !== undefined && (
        <p className="text-xs text-text-muted">
          Tienes {studentBadgeCount} insignia{studentBadgeCount !== 1 ? "s" : ""} de {subjectName}
        </p>
      )}

      {onRedeem && (
        <Button
          size="sm"
          className="mt-auto w-full"
          onClick={onRedeem}
          loading={redeeming}
          disabled={!canRedeem}
        >
          {canRedeem ? "Canjear" : remaining <= 0 ? "Agotado" : "Insuficientes badges"}
        </Button>
      )}
    </Card>
  );
}
