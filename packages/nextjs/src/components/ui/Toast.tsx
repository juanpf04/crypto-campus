"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ToastVariant } from "@/contexts/ToastContext";

interface ToastProps {
  message: string;
  variant: ToastVariant;
  duration: number;
  onClose: () => void;
}

const variantStyles: Record<ToastVariant, { accent: string; dot: string; bar: string }> = {
  success: {
    accent: "text-success",
    dot: "bg-success",
    bar: "bg-success",
  },
  danger: {
    accent: "text-danger",
    dot: "bg-danger",
    bar: "bg-danger",
  },
  warning: {
    accent: "text-warning",
    dot: "bg-warning",
    bar: "bg-warning",
  },
  info: {
    accent: "text-primary",
    dot: "bg-primary",
    bar: "bg-primary",
  },
};

export function Toast({ message, variant, duration, onClose }: ToastProps) {
  const [alive, setAlive] = useState(true);
  const styles = variantStyles[variant];

  // Animación de salida antes de eliminar
  function handleClose() {
    setAlive(false);
    setTimeout(onClose, 250);
  }

  // Auto-dismiss tras expirar la duración
  useEffect(() => {
    const timer = setTimeout(handleClose, duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto relative w-[22rem] overflow-hidden rounded-lg border border-border-default bg-card text-text shadow-xl transition-all duration-250",
        alive
          ? "animate-[slideIn_250ms_ease-out_forwards]"
          : "animate-[slideOut_250ms_ease-in_forwards]",
      )}
    >
      {/* Contenido */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className={cn("h-2.5 w-2.5 shrink-0 rounded-full", styles.dot)}
          aria-hidden="true"
        />
        <p className="flex-1 text-sm font-semibold leading-5 text-text">{message}</p>
        <button
          type="button"
          onClick={handleClose}
          className={cn(
            "shrink-0 rounded-md p-1 transition-colors cursor-pointer hover:bg-black/5",
            styles.accent,
          )}
          aria-label="Cerrar notificación"
        >
          &#x2715;
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="h-1 w-full">
        <div
          className={cn("h-full", styles.bar)}
          style={{
            animation: `shrink ${duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}
