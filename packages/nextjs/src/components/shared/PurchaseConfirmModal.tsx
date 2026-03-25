"use client";

/**
 * PurchaseConfirmModal — Modal de confirmación de compra.
 *
 * Componente intermedio que compone: Modal (atómico) + Button (atómico)
 * + ProductImage (intermedio).
 *
 * Muestra un resumen de la compra antes de confirmarla:
 * - Lista de items con imagen, nombre, cantidad × precio, subtotal
 * - Total a pagar
 * - Saldo actual del usuario
 * - Saldo restante tras la compra
 * - Aviso si el saldo es insuficiente
 *
 * Se reutiliza en:
 * - Detalle de producto (compra directa de 1 producto con N unidades)
 * - Carrito (checkout de múltiples productos)
 */

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ProductImage } from "@/components/shared/ProductImage";

export interface PurchaseItem {
  name: string;
  quantity: number;
  unitPrice: number;
  imageUrl: string | null;
  category: string | null;
  color?: string | null;
  variantLabel?: string | null;
}

interface PurchaseConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  items: PurchaseItem[];
  balance: number;
  loading?: boolean;
}

export function PurchaseConfirmModal({
  open,
  onClose,
  onConfirm,
  items,
  balance,
  loading = false,
}: PurchaseConfirmModalProps) {
  /* ── Cálculos ── */
  const total = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const remainingBalance = balance - total;
  const insufficientBalance = remainingBalance < 0;
  const totalUnits = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <Modal open={open} onClose={onClose} title="Confirmar compra">
      <div className="space-y-5">
        {/* ── Lista de items ── */}
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              {/* Miniatura */}
              <div className="h-12 w-12 shrink-0 rounded-lg bg-primary/5 p-1">
                <ProductImage
                  imageUrl={item.imageUrl}
                  name={item.name}
                  category={item.category}
                  emojiSize="md"
                  className="h-full w-full object-contain"
                />
              </div>

              {/* Nombre + variante */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text truncate">{item.name}</p>
                {(item.variantLabel || item.color) && (
                  <p className="text-xs text-text-muted">{item.variantLabel ?? item.color}</p>
                )}
              </div>

              {/* Cantidad × precio */}
              <div className="shrink-0 text-right">
                <p className="text-sm text-text">
                  {item.quantity} &times; {item.unitPrice} ShopTokens
                </p>
                <p className="text-sm font-semibold text-text">
                  {item.unitPrice * item.quantity} ShopTokens
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Separador ── */}
        <div className="border-t border-border-default" />

        {/* ── Resumen financiero ── */}
        <div className="space-y-2">
          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-text-muted">
              Total ({totalUnits} {totalUnits === 1 ? "unidad" : "unidades"})
            </span>
            <span className="text-lg font-bold text-primary">{total} ShopTokens</span>
          </div>

          {/* Saldo actual */}
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Tu saldo actual</span>
            <span className="text-sm text-text">{balance} ShopTokens</span>
          </div>

          {/* Saldo restante */}
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Saldo tras la compra</span>
            <span
              className={`text-sm font-semibold ${
                insufficientBalance ? "text-danger" : "text-text"
              }`}
            >
              {insufficientBalance ? "Insuficiente" : `${remainingBalance} ShopTokens`}
            </span>
          </div>

          {/* Aviso de saldo insuficiente */}
          {insufficientBalance && (
            <p className="mt-2 rounded-lg bg-danger/10 p-3 text-sm text-danger">
              No tienes suficientes ShopTokens. Necesitas {total} ShopTokens pero solo tienes {balance} ShopTokens.
              Te faltan {Math.abs(remainingBalance)} ShopTokens.
            </p>
          )}
        </div>

        {/* ── Botones ── */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={insufficientBalance || loading}
            loading={loading}
            className="flex-1"
          >
            Confirmar compra
          </Button>
        </div>
      </div>
    </Modal>
  );
}
