"use client";

/**
 * CartSummary — Card sticky de resumen del carrito con botones de acción.
 *
 * Recibe totales y callbacks; no hace fetches ni navegación internamente.
 */

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface CartSummaryProps {
  totalUnits: number;
  totalPrice: number;
  onContinueShopping: () => void;
  onCheckout: () => void;
  checkingOut?: boolean;
}

export function CartSummary({
  totalUnits,
  totalPrice,
  onContinueShopping,
  onCheckout,
  checkingOut = false,
}: CartSummaryProps) {
  return (
    <div className="lg:sticky lg:top-6 self-start">
      <Card className="space-y-4">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-text">
            Total ({totalUnits} {totalUnits === 1 ? "unidad" : "unidades"})
          </p>
          <p className="text-xl font-bold text-primary">{totalPrice} ShopTokens</p>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={onContinueShopping} className="w-full">
            &larr; Seguir comprando
          </Button>
          <Button
            onClick={onCheckout}
            disabled={checkingOut}
            loading={checkingOut}
            className="w-full"
          >
            Finalizar compra
          </Button>
        </div>
      </Card>
    </div>
  );
}
