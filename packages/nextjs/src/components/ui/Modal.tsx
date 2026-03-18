"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={cn(
        "fixed inset-0 m-auto rounded-xl border border-border-default bg-card p-0 shadow-lg backdrop:bg-black/50",
        "max-w-lg w-full max-h-[85vh] overflow-y-auto",
        className,
      )}
    >
      <div className="p-6">
        {title && (
          <div className="mb-4 flex items-center justify-between border-b border-border-default pb-4">
            <h2 className="text-lg font-semibold text-text">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-text-muted hover:text-text hover:bg-border-default transition-colors cursor-pointer"
              aria-label="Cerrar"
            >
              &#x2715;
            </button>
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}
