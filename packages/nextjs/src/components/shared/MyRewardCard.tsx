"use client";

/**
 * MyRewardCard — Tarjeta agregada de una recompensa canjeada por el alumno.
 * Muestra los contadores (Disponibles / Pendiente / Usada) y un selector
 * inline para solicitar uso de N tokens.
 */

import { useState } from "react";
import type { RewardCategory } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RewardCategoryIcon, getCategoryLabel } from "@/components/shared/RewardCategoryIcon";

interface MyRewardCardProps {
  rewardId: string;
  name: string;
  description: string | null;
  category: RewardCategory;
  available: number;
  pending: number;
  approved: number;
  onRequestUse: (quantity: number) => Promise<void>;
  processing?: boolean;
}

export function MyRewardCard({
  name,
  description,
  category,
  available,
  pending,
  approved,
  onRequestUse,
  processing,
}: MyRewardCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const canRequest = available > 0 && !processing;

  function openPicker() {
    setQuantity(1);
    setPickerOpen(true);
  }

  async function handleConfirm() {
    await onRequestUse(quantity);
    setPickerOpen(false);
  }

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

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-bg border border-border-default p-2.5 text-center">
        <div>
          <p className="text-xl font-bold text-success leading-none">{available}</p>
          <p className="text-[11px] text-text-muted mt-1">Disponibles</p>
        </div>
        <div className="border-x border-border-default">
          <p className="text-xl font-bold text-warning leading-none">{pending}</p>
          <p className="text-[11px] text-text-muted mt-1">Pendientes</p>
        </div>
        <div>
          <p className="text-xl font-bold text-text-muted leading-none">{approved}</p>
          <p className="text-[11px] text-text-muted mt-1">Usadas</p>
        </div>
      </div>

      {!pickerOpen ? (
        <Button
          size="sm"
          className="mt-auto w-full"
          onClick={openPicker}
          disabled={!canRequest}
        >
          {available === 0
            ? (pending > 0 ? "Ya has solicitado todas" : "Sin tokens disponibles")
            : "Solicitar uso"}
        </Button>
      ) : (
        <div className="mt-auto space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-text">Cantidad a solicitar</label>
            <select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              disabled={processing}
              className="rounded-md border border-border-default bg-card px-2 py-1 text-sm text-text focus:border-primary focus:outline-none disabled:opacity-50"
            >
              {Array.from({ length: available }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-text-muted">
            Máximo: {available} (no cuentan las pendientes)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={() => setPickerOpen(false)}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleConfirm}
              loading={processing}
            >
              {processing ? `Solicitando…` : `Confirmar ${quantity}`}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
