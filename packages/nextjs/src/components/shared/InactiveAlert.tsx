"use client";

/**
 * InactiveAlert — Banner de alerta para recursos desactivados.
 *
 * Componente intermedio reutilizable para mostrar que un recurso
 * (producto, impresora, etc.) está desactivado y no es visible
 * para los usuarios normales.
 *
 * Compone: Button (atómico) + icono warning inline.
 */

import { Button } from "@/components/ui/Button";

interface InactiveAlertProps {
  /** Nombre del recurso desactivado */
  resourceName?: string;
  /** Texto personalizado del mensaje */
  message?: string;
  /** Texto del botón de acción */
  actionLabel?: string;
  /** Callback al pulsar el botón */
  onAction?: () => void;
  /** Estado de carga del botón */
  loading?: boolean;
}

export function InactiveAlert({
  resourceName,
  message,
  actionLabel = "Reactivar",
  onAction,
  loading,
}: InactiveAlertProps) {
  const defaultMessage = resourceName
    ? `${resourceName} está desactivado y no es visible para los estudiantes.`
    : "Este recurso está desactivado y no es visible para los estudiantes.";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-warning shrink-0">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <p className="text-sm text-text flex-1">{message ?? defaultMessage}</p>
      {onAction && (
        <Button
          size="sm"
          variant="success"
          onClick={onAction}
          loading={loading}
          className="shrink-0"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
