"use client";

import { Modal, Button } from "@/components/ui";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
}

/**
 * Modal genérico de confirmación.
 *
 * Convención cromática (consistente en toda la app):
 * - Botón "Cancelar" → rojo (`danger`).
 * - Botón de confirmación → azul (`primary`).
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  loading,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-text-muted mb-6">{description}</p>
      <div className="flex justify-end gap-3">
        <Button variant="danger" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
