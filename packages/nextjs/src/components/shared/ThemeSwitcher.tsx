"use client";

/**
 * Toggle de tema claro/oscuro.
 *
 * Muestra un botón con icono de sol o luna según el tema activo.
 * Al hacer clic, alterna entre "Predeterminado" y "Oscuro"
 * y guarda la preferencia en localStorage.
 */

import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface ThemeSwitcherProps {
  /** Modo colapsado del sidebar: solo muestra el icono */
  collapsed?: boolean;
}

export function ThemeSwitcher({ collapsed = false }: ThemeSwitcherProps) {
  const { themeId, setThemeId } = useTheme();
  const isDark = themeId === "dark";

  const toggle = () => setThemeId(isDark ? "light" : "dark");

  return (
    <button
      onClick={toggle}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-muted",
        "transition-colors hover:bg-primary/10 hover:text-text",
      )}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {isDark ? (
        /* Icono sol — modo oscuro activo, clic para volver a claro */
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        /* Icono luna — modo claro activo, clic para cambiar a oscuro */
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
      {!collapsed && <span>{isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}</span>}
    </button>
  );
}
