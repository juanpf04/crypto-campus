"use client";

import { cn } from "@/lib/utils";

type AlertVariant = "success" | "warning" | "danger" | "info";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

const variantStyles: Record<AlertVariant, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  info: "border-primary/30 bg-primary/10 text-primary",
};

export function Alert({ variant = "info", title, children, onClose, className }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        variantStyles[variant],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          {title && <p className="font-semibold mb-1">{title}</p>}
          <div>{children}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
            aria-label="Cerrar"
          >
            &#x2715;
          </button>
        )}
      </div>
    </div>
  );
}
