"use client";

/**
 * CategoryFilter — Fila horizontal de pills/chips para filtrar por categoría.
 *
 * Muestra un chip "Todas" + un chip por cada categoría.
 * El chip activo tiene fondo primary, los demás fondo card con borde.
 * Reutilizable en cualquier lista filtrable por categoría.
 */

import { cn } from "@/lib/utils";

interface CategoryFilterOption {
  value: string;
  label: string;
}

interface CategoryFilterProps {
  /** Lista de categorías disponibles. Pueden ser strings o { value, label }. */
  categories: string[] | CategoryFilterOption[];
  /** Categoría seleccionada (null = "Todas") */
  selected: string | null;
  /** Callback al seleccionar una categoría */
  onSelect: (category: string | null) => void;
  /** Si false, no se muestra el chip "Todas" (por defecto true) */
  showAll?: boolean;
  /** Etiqueta del chip "Todas" (por defecto "Todas") */
  allLabel?: string;
  /** Clase CSS adicional */
  className?: string;
}

export function CategoryFilter({
  categories,
  selected,
  onSelect,
  showAll = true,
  allLabel = "Todas",
  className,
}: CategoryFilterProps) {
  const baseChip =
    "inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer select-none";
  const activeChip = "bg-primary text-white";
  const inactiveChip = "bg-card border border-border-default text-text-muted hover:border-primary/50 hover:text-text";

  const normalized: CategoryFilterOption[] = categories.map((c) =>
    typeof c === "string" ? { value: c, label: c } : c,
  );

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {showAll && (
        <button
          type="button"
          className={cn(baseChip, selected === null ? activeChip : inactiveChip)}
          onClick={() => onSelect(null)}
        >
          {allLabel}
        </button>
      )}
      {normalized.map((cat) => (
        <button
          key={cat.value}
          type="button"
          className={cn(baseChip, selected === cat.value ? activeChip : inactiveChip)}
          onClick={() => onSelect(cat.value)}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
