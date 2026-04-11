"use client";

/**
 * Hook de conveniencia para acceder al contexto de tema.
 * Devuelve { themeId, setThemeId } para leer y cambiar la paleta activa.
 */

import { useContext } from "react";
import { ThemeContext } from "@/contexts/ThemeContext";

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
