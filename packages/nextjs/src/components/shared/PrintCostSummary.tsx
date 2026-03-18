"use client";

/**
 * Panel de resumen de coste de impresión en tiempo real.
 *
 * Calcula cuántos créditos consumirá el trabajo:
 *   hojas = ceil(páginas_seleccionadas / páginas_por_hoja)
 *   caras = hojas × copias
 *   (1 crédito = 1 cara impresa, el dúplex no reduce el coste)
 *
 * Se actualiza instantáneamente cuando el usuario cambia cualquier parámetro.
 */

import { Card } from "@/components/ui/Card";

interface PrintCostSummaryProps {
  /** Páginas del documento seleccionado (o del rango) */
  pages: number;
  /** Número de copias */
  copies: number;
  /** Páginas por hoja (1, 2 o 4) — reduce el número de hojas necesarias */
  pagesPerSheet: number;
  /** Créditos actuales del usuario */
  availableCredits: number;
}

export function PrintCostSummary({ pages, copies, pagesPerSheet, availableCredits }: PrintCostSummaryProps) {
  // Las páginas por hoja reducen las hojas necesarias (redondeando arriba por si quedan sueltas)
  const sheets = Math.ceil(pages / pagesPerSheet);
  // 1 crédito = 1 cara impresa = 1 hoja (independientemente de dúplex)
  const totalCredits = sheets * copies;
  const hasEnough = availableCredits >= totalCredits;
  const remaining = availableCredits - totalCredits;

  return (
    <Card className="space-y-3">
      <h4 className="text-sm font-semibold text-text">Resumen de coste</h4>

      <div className="space-y-1.5 text-sm">
        {/* Desglose */}
        <div className="flex justify-between text-text-muted">
          <span>Páginas del documento</span>
          <span>{pages}</span>
        </div>
        {pagesPerSheet > 1 && (
          <div className="flex justify-between text-text-muted">
            <span>Páginas por hoja</span>
            <span>{pagesPerSheet}</span>
          </div>
        )}
        <div className="flex justify-between text-text-muted">
          <span>Hojas necesarias</span>
          <span>{sheets}</span>
        </div>
        <div className="flex justify-between text-text-muted">
          <span>Copias</span>
          <span>× {copies}</span>
        </div>

        {/* Separador */}
        <div className="border-t border-border-default my-2" />

        {/* Total */}
        <div className="flex justify-between font-semibold text-text">
          <span>Total créditos</span>
          <span>{totalCredits}</span>
        </div>

        {/* Créditos disponibles */}
        <div className="flex justify-between text-text-muted">
          <span>Disponibles</span>
          <span>{availableCredits}</span>
        </div>

        {/* Restante después de imprimir */}
        <div className={`flex justify-between font-medium ${hasEnough ? "text-success" : "text-danger"}`}>
          <span>Restante</span>
          <span>{remaining}</span>
        </div>
      </div>

      {/* Advertencia si no tiene suficientes créditos */}
      {!hasEnough && (
        <p className="text-xs text-danger bg-danger/10 rounded-md px-3 py-2">
          No tienes suficientes créditos. Necesitas {totalCredits - availableCredits} más.
        </p>
      )}
    </Card>
  );
}
