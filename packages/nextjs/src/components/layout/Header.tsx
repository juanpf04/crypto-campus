"use client";

import { cn } from "@/lib/utils";

interface HeaderProps {
  /** Callback para abrir/cerrar el sidebar en móvil */
  onToggleSidebar?: () => void;
  className?: string;
}

export function Header({ onToggleSidebar, className }: HeaderProps) {
  return (
    <header
      className={cn(
        "flex h-16 items-center gap-4 border-b border-border-default bg-card px-6",
        className,
      )}
    >
      {/* Botón hamburguesa — solo visible en móvil */}
      {onToggleSidebar && (
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-border-default/50 hover:text-text transition-colors lg:hidden"
          aria-label="Abrir menú"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      {/* Espacio flexible para futuros elementos (breadcrumbs, search, etc.) */}
      <div className="flex-1" />
    </header>
  );
}
