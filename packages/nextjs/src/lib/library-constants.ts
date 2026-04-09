/**
 * Constantes compartidas del módulo de biblioteca.
 * Opciones de filtro y mapeos de etiquetas reutilizados en múltiples páginas.
 */

export const LIBRARY_TYPE_OPTIONS = [
  { value: "ALL" as const, label: "Todos" },
  { value: "BOOK" as const, label: "Libros" },
  { value: "BOARD_GAME" as const, label: "Juegos de mesa" },
  { value: "VIDEO_GAME" as const, label: "Videojuegos" },
  { value: "OTHER" as const, label: "Otros" },
];

export const LOAN_STATUS_OPTIONS = [
  { value: "ALL" as const, label: "Todos" },
  { value: "REQUESTED" as const, label: "Pendientes" },
  { value: "APPROVED" as const, label: "Activos" },
  { value: "REJECTED" as const, label: "Rechazados" },
  { value: "RETURNED" as const, label: "Devueltos" },
];

export const TYPE_LABELS: Record<string, string> = {
  BOOK: "Libro",
  BOARD_GAME: "Juego de mesa",
  VIDEO_GAME: "Videojuego",
  OTHER: "Otro",
};

export const TYPE_EMOJI: Record<string, string> = {
  BOOK: "\u{1F4DA}",
  BOARD_GAME: "\u{1F3B2}",
  VIDEO_GAME: "\u{1F3AE}",
  OTHER: "\u{1F4E6}",
};

export type LibraryTypeFilter = "ALL" | "BOOK" | "BOARD_GAME" | "VIDEO_GAME" | "OTHER";
export type LoanStatusFilter = "ALL" | "REQUESTED" | "APPROVED" | "REJECTED" | "RETURNED";
