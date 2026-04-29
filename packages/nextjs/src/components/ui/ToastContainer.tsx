"use client";

import { useToast } from "@/hooks/useToast";
import { Toast } from "./Toast";

const TOAST_DURATION = 5_000;

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          duration={TOAST_DURATION}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}
