"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

/**
 * Select personalizado con flecha SVG propia.
 *
 * - `appearance-none` oculta la flecha nativa del navegador.
 * - Se añade padding derecho (pr-10) para dejar espacio a la flecha SVG.
 * - La flecha se posiciona con `pointer-events-none` para que los clics
 *   pasen al <select> de debajo.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, id, className, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-text">
            {label}
          </label>
        )}

        {/* Contenedor relativo para posicionar la flecha sobre el select */}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              // Apariencia base — ocultamos la flecha nativa
              "w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--card)]",
              "px-3 py-2 pr-10 text-sm text-text",
              "placeholder:text-text-muted",
              // Focus ring igual que los Input
              "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
              // Estados deshabilitado y error
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error && "border-danger focus:ring-danger focus:border-danger",
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Flecha SVG personalizada — separada del borde derecho con right-3 */}
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg
              className="h-4 w-4 text-text-muted"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  },
);

Select.displayName = "Select";
