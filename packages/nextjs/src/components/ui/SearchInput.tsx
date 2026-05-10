"use client";

/**
 * Input de búsqueda con icono de lupa y debounce integrado.
 *
 * Espera a que el usuario deje de escribir (300ms por defecto)
 * antes de disparar el callback onSearch. Evita llamadas excesivas
 * al backend mientras se escribe.
 *
 * Reutilizable en cualquier lista filtrable: logs, usuarios, impresoras...
 */

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  /** Texto placeholder */
  placeholder?: string;
  /** Callback cuando el valor debounced cambia */
  onSearch: (value: string) => void;
  /** Milisegundos de espera antes de disparar onSearch (default 300) */
  debounceMs?: number;
  /** Clases CSS adicionales para el contenedor */
  className?: string;
  /** Etiqueta accesible (sr-only). Por defecto usa el placeholder. */
  ariaLabel?: string;
}

export function SearchInput({
  placeholder = "Buscar...",
  onSearch,
  debounceMs = 300,
  className,
  ariaLabel,
}: SearchInputProps) {
  const [value, setValue] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    setValue(newValue);

    // Cancelar el timeout anterior y programar uno nuevo
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onSearch(newValue.trim());
    }, debounceMs);
  }

  return (
    <div className={cn("relative", className)}>
      {/* Icono de lupa */}
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
        <svg
          className="h-4 w-4 text-text-muted"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      <input
        type="search"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          "w-full rounded-lg border border-border-default bg-card pl-10 pr-3 py-2 text-sm text-text",
          "placeholder:text-text-muted",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
        )}
      />
    </div>
  );
}
