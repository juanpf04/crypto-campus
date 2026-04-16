/**
 * Constantes de colores para gráficos de dashboards.
 * Centraliza los color maps usados en PieCharts y otros visuales.
 */

/** Colores por tipo de ítem de biblioteca */
export const LIBRARY_TYPE_COLORS: Record<string, string> = {
  BOOK: "#3b82f6",
  BOARD_GAME: "#8b5cf6",
  VIDEO_GAME: "#f59e0b",
  OTHER: "#6b7280",
};

/** Colores por rol de usuario */
export const USER_ROLE_COLORS: Record<string, string> = {
  Estudiantes: "#3b82f6",
  Profesores: "#22c55e",
  Bibliotecarios: "#f59e0b",
  Admins: "#ef4444",
};

/** Colores por estado de tarea (para paneles docentes) */
export const ASSIGNMENT_STATUS_COLORS: Record<string, string> = {
  OPEN: "#3b82f6",
  REVIEWING: "#f59e0b",
  CLOSED: "#6b7280",
};
