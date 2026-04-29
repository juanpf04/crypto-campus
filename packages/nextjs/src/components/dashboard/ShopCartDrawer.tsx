"use client";

/**
 * ShopCartDrawer — Organism del carrito de compras (drawer lateral).
 *
 * Promovido desde components/shared/CartDrawer porque orquesta 6 fetches
 * (cart, balance, patch, delete, clear, checkout) y un overlay de compra,
 * lo que lo saca del contrato de "molécula sin side-effects".
 *
 * Montado en student/shop/layout.tsx y disparado vía CartContext.
 *
 * Props:
 * - open/onClose: control de visibilidad
 * - onCartChange: callback cuando el carrito cambia (para actualizar contadores)
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { Spinner } from "@/components/ui/Spinner";
import { icons } from "@/components/ui/icons";
import { ProductImage } from "@/components/shared/ProductImage";
import { PurchaseConfirmModal, type PurchaseItem } from "@/components/shared/PurchaseConfirmModal";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { useToast } from "@/hooks/useToast";
import { useCart } from "@/contexts/CartContext";

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  imageUrl: string | null;
  category: string | null;
  color: string | null;
  variantLabel: string | null;
  subtotal: number;
}

interface CartPayload {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
}

interface ShopCartDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Callback cuando el carrito cambia (items añadidos/eliminados/cantidad) */
  onCartChange?: (itemCount: number, total: number) => void;
}

export function ShopCartDrawer({ open, onClose, onCartChange }: ShopCartDrawerProps) {
  const { addToast } = useToast();
  const { startPurchase } = useCart();
  const [cart, setCart] = useState<CartPayload | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const loadCart = useCallback(async () => {
    setLoading(true);
    try {
      const [cartRes, balanceRes] = await Promise.all([
        fetch("/api/shop/cart"),
        fetch("/api/shop/balance"),
      ]);
      const [cartBody, balanceBody] = await Promise.all([
        cartRes.json(),
        balanceRes.json(),
      ]);

      if (cartRes.ok) {
        setCart(cartBody);
        setBalance(balanceBody.balance ?? 0);
        const itemCount = cartBody.items?.length ?? 0;
        const total = cartBody.total ?? 0;
        onCartChange?.(itemCount, total);
      }
    } catch {
      // Silencioso — el drawer mostrará estado vacío
    } finally {
      setLoading(false);
    }
  }, [onCartChange]);

  useEffect(() => {
    if (open) loadCart();
  }, [open, loadCart]);

  function notifyChange(updatedCart: CartPayload) {
    setCart(updatedCart);
    const itemCount = updatedCart.items?.length ?? 0;
    onCartChange?.(itemCount, updatedCart.total ?? 0);
  }

  async function updateQuantity(itemId: string, newQuantity: number) {
    if (newQuantity < 1) return;

    const res = await fetch("/api/shop/cart", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, quantity: newQuantity }),
    });
    const body = await res.json();
    if (!res.ok) {
      addToast(body.error ?? "No se pudo actualizar", "danger");
      return;
    }
    notifyChange(body);
  }

  async function removeItem(itemId: string) {
    const res = await fetch(`/api/shop/cart?itemId=${itemId}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      addToast(body.error ?? "No se pudo eliminar", "danger");
      return;
    }
    notifyChange(body);
    addToast("Producto eliminado del carrito", "success");
  }

  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function confirmClearCart() {
    setClearing(true);
    try {
      const res = await fetch("/api/shop/cart?clear=1", { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        addToast(body.error ?? "No se pudo vaciar", "danger");
        return;
      }
      notifyChange(body);
      addToast("Carrito vaciado", "success");
      setClearOpen(false);
    } finally {
      setClearing(false);
    }
  }

  function handleConfirmCheckout() {
    setConfirmOpen(false);

    setCart(null);
    onCartChange?.(0, 0);
    setCheckingOut(false);
    onClose();

    const itemNames = cart?.items.map((i) => i.name) ?? [];
    const overlayName = itemNames.length <= 2
      ? itemNames.join(", ")
      : `${itemNames[0]} y ${itemNames.length - 1} más`;

    const checkoutPromise = (async () => {
      const res = await fetch("/api/shop/checkout", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        addToast(body.error ?? "Error en el pago", "danger");
        return null;
      }
      return (body.batchId as string) ?? null;
    })();

    startPurchase(checkoutPromise, overlayName);
  }

  const isEmpty = !cart || cart.items.length === 0;
  const totalUnits = cart?.items.reduce((a, i) => a + i.quantity, 0) ?? 0;

  const purchaseItems: PurchaseItem[] = cart?.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.price,
    imageUrl: item.imageUrl,
    category: item.category,
    color: item.color,
    variantLabel: item.variantLabel,
  })) ?? [];

  const drawerFooter = !isEmpty ? (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-text-muted">
          Total ({totalUnits} {totalUnits === 1 ? "ud." : "uds."})
        </span>
        <span className="text-xl font-bold text-primary">{cart?.total ?? 0} ShopTokens</span>
      </div>

      <Button
        onClick={() => setConfirmOpen(true)}
        disabled={checkingOut}
        loading={checkingOut}
        className="w-full"
        size="lg"
      >
        Finalizar compra
      </Button>

      <Button
        variant="outline"
        onClick={onClose}
        className="w-full"
      >
        Seguir comprando
      </Button>

      <Link
        href="/student/shop/cart"
        onClick={() => onClose()}
        className="w-full text-center text-sm text-text-muted hover:text-primary transition-colors cursor-pointer underline block"
      >
        Ver carrito completo
      </Link>
    </div>
  ) : undefined;

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title="Mi carrito"
        side="right"
        width="max-w-sm"
        footer={drawerFooter}
      >
        {loading ? (
          <div className="flex items-center justify-center py-10 text-primary">
            <Spinner size="md" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 text-text-muted/40 [&_svg]:h-16 [&_svg]:w-16">
              {icons.cart}
            </div>
            <p className="text-text-muted mb-4">Tu carrito esta vacio</p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Explorar tienda
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setClearOpen(true)}
                className="text-xs text-danger hover:text-danger-hover transition-colors cursor-pointer underline"
              >
                Vaciar carrito
              </button>
            </div>

            {cart.items.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 rounded-lg border border-border-default p-3"
              >
                <div className="h-16 w-16 shrink-0 rounded-lg bg-primary/5 p-1">
                  <ProductImage
                    imageUrl={item.imageUrl}
                    name={item.name}
                    category={item.category}
                    className="h-full w-full object-contain"
                    emojiSize="md"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text line-clamp-2 leading-tight">
                    {item.name}
                  </p>
                  {(item.variantLabel || item.color) && (
                    <p className="text-xs text-text-muted mt-0.5">
                      {item.variantLabel ?? item.color}
                    </p>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <QuantitySelector
                      value={item.quantity}
                      onChange={(q) => updateQuantity(item.id, q)}
                      min={1}
                      max={item.stock}
                      size="sm"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text">
                        {item.subtotal} ShopTokens
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="rounded p-1 text-text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer [&_svg]:h-4 [&_svg]:w-4"
                        aria-label="Eliminar "
                      >
                        {icons.close}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Drawer>

      <ConfirmModal
        open={clearOpen}
        onClose={() => { if (!clearing) setClearOpen(false); }}
        onConfirm={confirmClearCart}
        title="Vaciar carrito"
        description="Se eliminarán todos los productos del carrito. Tendrás que volver a añadirlos si quieres comprarlos."
        confirmLabel="Vaciar"
        loading={clearing}
      />

      <PurchaseConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmCheckout}
        items={purchaseItems}
        balance={balance}
        loading={checkingOut}
      />
    </>
  );
}
