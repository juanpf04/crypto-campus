"use client";

/**
 * DangerConfirmModal — Confirmación con type-to-confirm para acciones nucleares.
 *
 * El admin debe escribir literalmente la frase indicada en `confirmPhrase`
 * (case-sensitive) para habilitar el botón de confirmación. Sirve como freno
 * explícito ante operaciones destructivas a gran escala (p.ej. "Pausar todo").
 */

import { useState } from "react";
import { Modal, Button } from "@/components/ui";

interface DangerConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  /** Texto exacto que el admin debe escribir para habilitar la confirmación. */
  confirmPhrase: string;
  confirmLabel?: string;
  loading?: boolean;
}

/**
 * Asume que el padre desmonta el componente al cerrar (render condicional).
 * Eso garantiza que `typed` arranca vacío en cada apertura sin tener que
 * resetear estado en un useEffect.
 */
export function DangerConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmPhrase,
  confirmLabel = "Confirmar",
  loading,
}: DangerConfirmModalProps) {
  const [typed, setTyped] = useState("");
  const matches = typed === confirmPhrase;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-text-muted mb-4">{description}</p>

      <label className="block text-sm font-medium text-text mb-1.5">
        Escribe <span className="font-mono text-danger">{confirmPhrase}</span> para confirmar
      </label>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        disabled={loading}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-lg border border-border-default bg-card px-3 py-2 font-mono text-sm text-text focus:outline-none focus:ring-2 focus:ring-danger focus:border-danger disabled:opacity-50 mb-6"
      />

      <div className="flex justify-end gap-3">
        <Button variant="danger" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={!matches || loading} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
