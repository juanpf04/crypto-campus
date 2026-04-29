"use client";

import { Modal, Button } from "@/components/ui";

interface InfoModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  acceptLabel?: string;
}

/**
 * Modal informativo de un solo botón (Aceptar).
 *
 * Se usa cuando hay que avisar al usuario de algo que NO se puede hacer
 * (p. ej. "no puedes desactivar este ítem porque tiene préstamos activos"),
 * para evitar abrirle una confirmación que después fallaría.
 */
export function InfoModal({
  open,
  onClose,
  title,
  description,
  acceptLabel = "Aceptar",
}: InfoModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-text-muted mb-6">{description}</p>
      <div className="flex justify-end">
        <Button variant="primary" onClick={onClose}>
          {acceptLabel}
        </Button>
      </div>
    </Modal>
  );
}
