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

const variantStyles: Record<ToastVariant, { container: string; bar: string }> = {
  success: {
    container: "border-success/40 bg-success/10 text-success",
    bar: "bg-success",
  },
  danger: {
    container: "border-danger/40 bg-danger/10 text-danger",
    bar: "bg-danger",
  },
  warning: {
    container: "border-warning/40 bg-warning/10 text-warning",
    bar: "bg-warning",
  },
  info: {
    container: "border-primary/40 bg-primary/10 text-primary",
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
        "pointer-events-auto relative w-80 overflow-hidden rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-250",
        styles.container,
        alive
          ? "animate-[slideIn_250ms_ease-out_forwards]"
          : "animate-[slideOut_250ms_ease-in_forwards]",
      )}
    >
      {/* Contenido */}
      <div className="flex items-center gap-2 px-4 py-3">
        <p className="flex-1 text-sm font-medium">{message}</p>
        <button
          onClick={handleClose}
          className="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
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
