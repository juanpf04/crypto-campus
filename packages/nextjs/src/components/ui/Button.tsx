"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

type ButtonVariant = "primary" | "secondary" | "danger" | "success" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary text-text-on-primary hover:bg-primary-hover focus-visible:ring-primary",
  secondary: "bg-secondary text-text-on-primary hover:bg-secondary-hover focus-visible:ring-secondary",
  danger: "bg-danger text-text-on-danger hover:bg-danger-hover focus-visible:ring-danger",
  success: "bg-success text-white hover:bg-success-hover focus-visible:ring-success",
  ghost: "bg-transparent text-text hover:bg-border-default focus-visible:ring-border-default",
  outline: "border border-border-default bg-transparent text-text hover:bg-card focus-visible:ring-border-default",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, children, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {loading && <Spinner size="sm" />}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
