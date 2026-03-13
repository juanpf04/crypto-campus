/**
 * utils.ts — Utilidad para componer clases de Tailwind CSS sin conflictos.
 *
 * cn() combina dos librerías:
 * 1. clsx: Acepta clases en múltiples formatos (strings, objetos condicionales,
 *    arrays) y los une en un solo string.
 *    Ejemplo: clsx("px-4", { "bg-red": hasError }, undefined) → "px-4 bg-red"
 *
 * 2. twMerge: Resuelve conflictos entre clases de Tailwind.
 *    Ejemplo: twMerge("px-4 px-6") → "px-6" (la última gana).
 *    Sin twMerge, ambas clases coexistirían y el resultado sería impredecible.
 *
 * Flujo: cn("px-4 py-2", conditional && "bg-primary", className)
 *   → clsx une todo → "px-4 py-2 bg-primary custom-class"
 *   → twMerge elimina duplicados/conflictos → resultado limpio.
 *
 * Se usa en todos los componentes UI para permitir sobreescribir estilos
 * desde fuera sin que los estilos base entren en conflicto.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
