/**
 * Definición de los 2 temas de CryptoCampus: Predeterminado y Oscuro.
 *
 * Cada tema es un objeto que mapea las CSS custom properties
 * usadas en globals.css → @theme inline → clases Tailwind.
 *
 * Para cambiar de tema en tiempo real basta con sobreescribir
 * las variables en document.documentElement.style.
 */

export interface ThemePalette {
  /** Identificador único del tema */
  id: string;
  /** Nombre visible para el usuario */
  name: string;
  /** Descripción corta */
  description: string;
  /** Color representativo para la preview */
  preview: string;
  /** Valores de las CSS custom properties (sin el --) */
  values: Record<string, string>;
}

export const THEMES: ThemePalette[] = [
  {
    id: "light",
    name: "Predeterminado",
    description: "Modo claro",
    preview: "#0B63A6",
    values: {
      primary: "#0B63A6",
      "primary-hover": "#083E66",
      secondary: "#4A90D9",
      "secondary-hover": "#3A7BC8",
      accent: "#F2C94C",
      "accent-hover": "#E0B83A",

      success: "#2EAD6F",
      "success-hover": "#249A5E",
      warning: "#F2C94C",
      "warning-hover": "#E0B83A",
      danger: "#E05555",
      "danger-hover": "#C84444",

      bg: "#F5F7FA",
      card: "#FFFFFF",
      border: "#E2E8F0",
      "border-hover": "#CBD5E1",
      "border-swatch": "#E2E8F0",

      text: "#0B2233",
      "text-muted": "#64748B",
      "text-on-primary": "#FFFFFF",
      "text-on-danger": "#FFFFFF",
    },
  },
  {
    id: "dark",
    name: "Oscuro",
    description: "Modo oscuro",
    preview: "#0A6FFF",
    values: {
      primary: "#0A6FFF",
      "primary-hover": "#085CD6",
      secondary: "#0369A1",
      "secondary-hover": "#075985",
      accent: "#D4AF37",
      "accent-hover": "#BF9D2E",

      success: "#2ECC71",
      "success-hover": "#27AE60",
      warning: "#D4AF37",
      "warning-hover": "#BF9D2E",
      danger: "#FF4D4F",
      "danger-hover": "#E04345",

      bg: "#0B0F13",
      card: "#121624",
      border: "#1E2538",
      "border-hover": "#2A3347",
      "border-swatch": "#94A3B8",

      text: "#E6F0F6",
      "text-muted": "#8899AA",
      "text-on-primary": "#FFFFFF",
      "text-on-danger": "#FFFFFF",
    },
  },
];

/** Tema por defecto (claro) */
export const DEFAULT_THEME_ID = "light";

/**
 * Aplica un tema al documento sobreescribiendo las CSS custom properties.
 * Si se pasa un id que no existe, aplica el tema por defecto.
 */
export function applyTheme(themeId: string): void {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const root = document.documentElement;

  for (const [key, value] of Object.entries(theme.values)) {
    root.style.setProperty(`--${key}`, value);
  }
}
