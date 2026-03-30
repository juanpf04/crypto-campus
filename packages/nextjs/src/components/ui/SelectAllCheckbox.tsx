"use client";

/**
 * SelectAllCheckbox — Checkbox de seleccionar/deseleccionar todos.
 *
 * Componente atómico reutilizable para cualquier lista con selección múltiple.
 * Muestra un checkbox con label que refleja si todos están seleccionados.
 *
 * Props:
 * - allSelected: ¿están todos seleccionados?
 * - onToggle: callback con true (seleccionar todos) o false (deseleccionar)
 * - label: texto al lado del checkbox (default: "Seleccionar todos")
 */

interface SelectAllCheckboxProps {
  allSelected: boolean;
  onToggle: (selectAll: boolean) => void;
  label?: string;
  className?: string;
}

export function SelectAllCheckbox({
  allSelected,
  onToggle,
  label = "Seleccionar todos",
  className,
}: SelectAllCheckboxProps) {
  return (
    <label className={`flex items-center gap-3 cursor-pointer ${className ?? ""}`}>
      <input
        type="checkbox"
        checked={allSelected}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-4 w-4 rounded border-border-default text-primary focus:ring-primary cursor-pointer accent-[var(--primary)]"
      />
      <span className="text-sm font-semibold text-text">{label}</span>
    </label>
  );
}
