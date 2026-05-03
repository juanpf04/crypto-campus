"use client";

/**
 * ModuleStatusCard — Card de un módulo del sistema con su estado paused/active
 * y botones de pausa/despausa. Usado en /admin/system.
 *
 * - Estado "active":  badge verde, botón rojo "Pausar".
 * - Estado "paused":  badge rojo, botón verde "Despausar".
 * - Estado "partial": badge amarillo, dos botones (completar pausa o despausar todos).
 *
 * El loading es propio del card (no global) para que el admin pueda actuar
 * sobre varios módulos sin que se bloqueen entre sí.
 */

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { icons } from "@/components/ui/icons";
import type { ModuleStatusInfo } from "@/actions/system";

interface ModuleStatusCardProps {
  module: ModuleStatusInfo;
  loading?: boolean;
  disabled?: boolean;
  onPause: () => void;
  onUnpause: () => void;
}

const STATUS_BADGE: Record<ModuleStatusInfo["status"], { variant: "success" | "danger" | "warning"; label: string }> = {
  active:  { variant: "success", label: "Activo" },
  paused:  { variant: "danger",  label: "Pausado" },
  partial: { variant: "warning", label: "Parcial" },
};

export function ModuleStatusCard({ module, loading, disabled, onPause, onUnpause }: ModuleStatusCardProps) {
  const badge = STATUS_BADGE[module.status];
  const moduleIcon = icons[module.iconKey] ?? icons.alert;

  return (
    <Card className="flex flex-col gap-4">
      {/* Header: icono + nombre + badge */}
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {moduleIcon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-text truncate">{module.name}</h3>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">{module.description}</p>
        </div>
      </div>

      {/* Lista de contratos del módulo */}
      <div className="rounded-lg border border-border-default bg-bg/50 px-3 py-2 text-sm">
        {module.contracts.map((c) => (
          <div key={c.key} className="flex items-center justify-between py-1">
            <span className="font-mono text-xs text-text-muted">{c.label}</span>
            {c.paused ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-danger [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0">
                {icons.pause}
                Pausado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-success [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0">
                {icons.check}
                Activo
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Warning especial (p.ej. para módulo Roles) */}
      {module.warning && module.status === "active" && (
        <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-text">
          <span className="font-semibold text-warning">⚠ Aviso: </span>
          {module.warning}
        </div>
      )}

      {/* Botones según estado */}
      <div className="mt-auto flex gap-2">
        {module.status === "active" && (
          <Button
            variant="danger"
            className="w-full"
            onClick={onPause}
            disabled={disabled || loading}
            loading={loading}
          >
            <span className="flex items-center gap-2">
              {icons.pause} Pausar módulo
            </span>
          </Button>
        )}
        {module.status === "paused" && (
          <Button
            variant="success"
            className="w-full"
            onClick={onUnpause}
            disabled={disabled || loading}
            loading={loading}
          >
            <span className="flex items-center gap-2">
              {icons.play} Despausar módulo
            </span>
          </Button>
        )}
        {module.status === "partial" && (
          <>
            <Button
              variant="danger"
              className="flex-1"
              onClick={onPause}
              disabled={disabled || loading}
              loading={loading}
            >
              <span className="flex items-center gap-2">{icons.pause} Pausar todos</span>
            </Button>
            <Button
              variant="success"
              className="flex-1"
              onClick={onUnpause}
              disabled={disabled || loading}
              loading={loading}
            >
              <span className="flex items-center gap-2">{icons.play} Despausar todos</span>
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
