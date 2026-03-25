"use client";

/**
 * FloatingCartButton — Botón flotante del carrito (FAB).
 *
 * Componente atómico reutilizable. Se posiciona en la esquina
 * inferior derecha de la pantalla con el icono del carrito
 * y un badge con el número de items. Al hacer clic ejecuta
 * el callback onClick (normalmente abre el drawer del carrito).
 *
 * Solo visible si hay items > 0.
 */

import { cn } from "@/lib/utils";

interface FloatingCartButtonProps {
  /** Número de items en el carrito */
  itemCount: number;
  /** Callback al hacer clic */
  onClick: () => void;
  className?: string;
}

export function FloatingCartButton({ itemCount, onClick, className }: FloatingCartButtonProps) {
  if (itemCount === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-30",
        "flex items-center gap-2 rounded-full bg-primary px-5 py-3",
        "text-white shadow-lg",
        "hover:bg-primary-hover active:scale-95",
        "transition-all duration-200 cursor-pointer",
        className,
      )}
      aria-label={`Ver carrito (${itemCount} productos)`}
    >
      {/* Icono carrito */}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
      </svg>

      {/* Badge con número */}
      <span className="text-sm font-bold">{itemCount}</span>
    </button>
  );
}
