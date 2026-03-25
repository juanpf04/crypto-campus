"use client";

/**
 * CartDrawer — Drawer lateral del carrito de compras.
 *
 * Componente intermedio que compone:
 * - Drawer (atómico) — panel slide-in
 * - QuantitySelector (atómico) — cantidad por item
 * - ProductImage (intermedio) — miniatura
 * - PurchaseConfirmModal (intermedio) — confirmación de checkout
 * - Button (atómico) — acciones
 *
 * Se monta en cualquier página de la tienda. Al añadir un producto
 * se abre automáticamente mostrando el carrito actualizado.
 *
 * Props:
 * - open/onClose: control de visibilidad
 * - onCartChange: callback cuando el carrito cambia (para actualizar contadores)
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { ProductImage } from "@/components/shared/ProductImage";
import { PurchaseConfirmModal, type PurchaseItem } from "@/components/shared/PurchaseConfirmModal";
import { useToast } from "@/hooks/useToast";

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

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Callback cuando el carrito cambia (items añadidos/eliminados/cantidad) */
  onCartChange?: (itemCount: number, total: number) => void;
}

export function CartDrawer({ open, onClose, onCartChange }: CartDrawerProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [cart, setCart] = useState<CartPayload | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  // Modal de confirmación
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  // Cargar carrito cuando se abre
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

  // Notificar cambios al padre
  function notifyChange(updatedCart: CartPayload) {
    setCart(updatedCart);
    const itemCount = updatedCart.items?.length ?? 0;
    onCartChange?.(itemCount, updatedCart.total ?? 0);
  }

  // Actualizar cantidad
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

  // Eliminar item
  async function removeItem(itemId: string) {
    const res = await fetch(`/api/shop/cart?itemId=${itemId}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      addToast(body.error ?? "No se pudo eliminar", "danger");
      return;
    }
    notifyChange(body);
    addToast("Producto eliminado", "success");
  }

  // Vaciar carrito
  async function clearCart() {
    const res = await fetch("/api/shop/cart?clear=1", { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      addToast(body.error ?? "No se pudo vaciar", "danger");
      return;
    }
    notifyChange(body);
    addToast("Carrito vaciado", "success");
  }

  // Checkout
  async function handleConfirmCheckout() {
    setCheckingOut(true);
    setConfirmOpen(false);

    try {
      const res = await fetch("/api/shop/checkout", { method: "POST" });
      const body = await res.json();

      if (!res.ok) {
        addToast(body.error ?? "Error en el pago", "danger");
        setCheckingOut(false);
        return;
      }

      addToast(
        `Compra realizada. Nuevo saldo: ${body.newBalance} ShopTokens`,
        "success",
      );
      onClose();
      router.push("/dashboard/student/shop/orders");
    } catch {
      addToast("Error al procesar el pago", "danger");
      setCheckingOut(false);
    }
  }

  const isEmpty = !cart || cart.items.length === 0;
  const totalUnits = cart?.items.reduce((a, i) => a + i.quantity, 0) ?? 0;

  // Items para el modal de confirmación
  const purchaseItems: PurchaseItem[] = cart?.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.price,
    imageUrl: item.imageUrl,
    category: item.category,
    color: item.color,
    variantLabel: item.variantLabel,
  })) ?? [];

  // Footer fijo con total + botones
  const drawerFooter = !isEmpty ? (
    <div className="space-y-3">
      {/* Total */}
      <div className="flex items-center justify-between">
        <span className="text-text-muted">
          Total ({totalUnits} {totalUnits === 1 ? "ud." : "uds."})
        </span>
        <span className="text-xl font-bold text-primary">{cart?.total ?? 0} ShopTokens</span>
      </div>

      {/* Finalizar compra */}
      <Button
        onClick={() => setConfirmOpen(true)}
        disabled={checkingOut}
        loading={checkingOut}
        className="w-full"
        size="lg"
      >
        Finalizar compra
      </Button>

      {/* Seguir comprando */}
      <Button
        variant="outline"
        onClick={onClose}
        className="w-full"
      >
        Seguir comprando
      </Button>

      {/* Ver carrito completo */}
      <button
        type="button"
        onClick={() => {
          onClose();
          router.push("/dashboard/student/shop/cart");
        }}
        className="w-full text-center text-sm text-text-muted hover:text-primary transition-colors cursor-pointer underline"
      >
        Ver carrito completo
      </button>
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
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {/* Icono carrito vacío */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-16 w-16 text-text-muted/40 mb-4">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
            </svg>
            <p className="text-text-muted mb-4">Tu carrito esta vacio</p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Explorar tienda
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Botón vaciar */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-danger hover:text-danger-hover transition-colors cursor-pointer underline"
              >
                Vaciar carrito
              </button>
            </div>

            {/* Lista de items */}
            {cart.items.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 rounded-lg border border-border-default p-3"
              >
                {/* Imagen */}
                <div className="h-16 w-16 shrink-0 rounded-lg bg-primary/5 p-1">
                  <ProductImage
                    imageUrl={item.imageUrl}
                    name={item.name}
                    category={item.category}
                    className="h-full w-full object-contain"
                    emojiSize="md"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text line-clamp-2 leading-tight">
                    {item.name}
                  </p>
                  {(item.variantLabel || item.color) && (
                    <p className="text-xs text-text-muted mt-0.5">
                      {item.variantLabel ?? item.color}
                    </p>
                  )}

                  {/* Precio + cantidad + eliminar */}
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
                        className="rounded p-1 text-text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                        aria-label="Eliminar"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Drawer>

      {/* Modal de confirmación */}
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
