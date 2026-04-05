"use client";

/**
 * FilterPills — Grupo de botones pill para filtrar por categoría/estado.
 * Átomo reutilizable en cualquier listado que necesite filtros.
 */

interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface FilterPillsProps<T extends string> {
  options: FilterOption<T>[];
  selected: T;
  onChange: (value: T) => void;
}

export function FilterPills<T extends string>({ options, selected, onChange }: FilterPillsProps<T>) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
            selected === opt.value
              ? "bg-primary text-white"
              : "bg-card border border-border-default text-text-muted hover:text-text"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
