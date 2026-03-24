"use client";

/**
 * CategoryFilter — Fila horizontal de pills/chips para filtrar por categoría.
 *
 * Muestra un chip "Todas" + un chip por cada categoría.
 * El chip activo tiene fondo primary, los demás fondo card con borde.
 * Reutilizable en cualquier lista filtrable por categoría.
 */

import { cn } from "@/lib/utils";

interface CategoryFilterProps {
  /** Lista de categorías disponibles */
  categories: string[];
  /** Categoría seleccionada (null = "Todas") */
  selected: string | null;
  /** Callback al seleccionar una categoría */
  onSelect: (category: string | null) => void;
  /** Clase CSS adicional */
  className?: string;
}

export function CategoryFilter({ categories, selected, onSelect, className }: CategoryFilterProps) {
  const baseChip =
    "inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer select-none";
  const activeChip = "bg-primary text-white";
  const inactiveChip = "bg-card border border-border-default text-text-muted hover:border-primary/50 hover:text-text";

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <button
        type="button"
        className={cn(baseChip, selected === null ? activeChip : inactiveChip)}
        onClick={() => onSelect(null)}
      >
        Todas
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          className={cn(baseChip, selected === cat ? activeChip : inactiveChip)}
          onClick={() => onSelect(cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
