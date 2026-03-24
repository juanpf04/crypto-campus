/**
 * formatters.ts — Funciones de formateo reutilizables en toda la app.
 *
 * Centraliza formateo de fechas, bytes y otros valores para evitar
 * duplicar las mismas funciones locales en múltiples páginas.
 */

/** Formatea fecha corta: "23 mar 2026" */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Formatea fecha completa con hora: "23 de marzo de 2026, 14:30" */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formatea bytes a cadena legible: "1.5 MB", "320 KB", "128 B" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
