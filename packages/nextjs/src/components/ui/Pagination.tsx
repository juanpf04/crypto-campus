"use client";

/**
 * Paginación reutilizable para cualquier tabla o lista.
 *
 * Muestra botones "Anterior" / "Siguiente" con indicador de página
 * central ("Página 1 de 5"). Se calcula automáticamente a partir
 * del total de registros, el límite por página y el offset actual.
 */

import { Button } from "./Button";

interface PaginationProps {
  /** Offset actual (número de registros saltados) */
  offset: number;
  /** Registros por página */
  limit: number;
  /** Total de registros disponibles */
  total: number;
  /** Callback cuando el usuario cambia de página */
  onChange: (newOffset: number) => void;
}

export function Pagination({ offset, limit, total, onChange }: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  // No mostrar paginación si solo hay una página
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-1 pt-4">
      {/* Anterior: solo visible si no es la primera página */}
      {hasPrev ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(Math.max(offset - limit, 0))}
        >
          Anterior
        </Button>
      ) : (
        <div />
      )}

      <span className="text-sm text-text-muted">
        Página {currentPage} de {totalPages}
      </span>

      {/* Siguiente: solo visible si no es la última página */}
      {hasNext ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(offset + limit)}
        >
          Siguiente
        </Button>
      ) : (
        <div />
      )}
    </div>
  );
}
