"use client";

/**
 * AddCard — Card con icono "+" para añadir un nuevo elemento.
 *
 * Componente atómico reutilizable como elemento de un grid.
 * Se integra visualmente como una card más con borde punteado
 * y hover en primary. Reutilizable para añadir variante, producto,
 * o cualquier recurso en una cuadrícula.
 */

import { cn } from "@/lib/utils";

interface AddCardProps {
  /** Texto debajo del icono */
  label?: string;
  /** Callback al clicar */
  onClick: () => void;
  className?: string;
}

export function AddCard({ label = "Añadir", onClick, className }: AddCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed",
        "border-border-default bg-card p-5 min-h-[200px]",
        "text-text-muted hover:border-primary hover:text-primary hover:bg-primary/5",
        "transition-all cursor-pointer",
        className,
      )}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
