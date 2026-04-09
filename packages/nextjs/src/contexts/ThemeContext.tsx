"use client";

/**
 * Contexto global para la gestión de la paleta de colores.
 *
 * Flujo:
 * 1. Al montar, lee la paleta guardada en localStorage ("theme-id").
 * 2. Si no hay ninguna guardada, usa la paleta por defecto (académica).
 * 3. Aplica las CSS custom properties al <html> con applyTheme().
 * 4. Cuando el usuario cambia de paleta con setThemeId(), se:
 *    a) Actualiza el estado de React.
 *    b) Persiste la elección en localStorage.
 *    c) Aplica las nuevas variables CSS inmediatamente.
 *
 * Los componentes acceden al tema con useContext(ThemeContext)
 * o con el hook useTheme().
 */

import { createContext, useEffect, useState, type ReactNode } from "react";
import { applyTheme, DEFAULT_THEME_ID } from "@/lib/themes";

interface ThemeContextValue {
  /** ID de la paleta activa */
  themeId: string;
  /** Cambia la paleta activa (persiste en localStorage) */
  setThemeId: (id: string) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  themeId: DEFAULT_THEME_ID,
  setThemeId: () => {},
});

const STORAGE_KEY = "theme-id";

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Inicializar leyendo localStorage cuando exista window.
  const [themeId, setThemeIdState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_THEME_ID;
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID;
  });

  // Aplicar la paleta activa al montar y cada vez que cambie.
  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  // Función pública para cambiar de tema
  const setThemeId = (id: string) => {
    setThemeIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}
