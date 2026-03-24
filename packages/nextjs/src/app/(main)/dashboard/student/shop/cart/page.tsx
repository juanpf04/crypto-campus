"use client";

/**
 * Carrito de la tienda del estudiante.
 *
 * Layout:
 * - Lista de items con imagen, nombre, variante, cantidad (editable),
 *   precio unitario, subtotal y botón eliminar
 * - Card de resumen con total y botón "Finalizar compra"
 * - Al finalizar: modal confirmación → checkout → redirige a pedidos
 *
 * Componentes usados:
 * - QuantitySelector (atómico) — selección de cantidad por item
 * - PurchaseConfirmModal (intermedio) — confirmación antes de pagar
 * - ProductImage (intermedio) — miniatura del producto
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { ProductImage } from "@/components/shared/ProductImage";
import { PurchaseConfirmModal, type PurchaseItem } from "@/components/shared/PurchaseConfirmModal";
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

export default function StudentCartPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { setItemCount } = useCart();
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartPayload | null>(null);
  const [balance, setBalance] = useState(0);

  // Modal de confirmación
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  // Carga inicial: carrito + balance
  const loadCart = useCallback(async () => {
    try {
      const [cartRes, balanceRes] = await Promise.all([
        fetch("/api/shop/cart"),
        fetch("/api/shop/balance"),
      ]);
      const [cartBody, balanceBody] = await Promise.all([
        cartRes.json(),
        balanceRes.json(),
      ]);

      if (!cartRes.ok) {
        addToast(cartBody.error ?? "Error al cargar el carrito", "danger");
        return;
      }
      setCart(cartBody);
      setItemCount(cartBody.items?.length ?? 0);
      setBalance(balanceBody.balance ?? 0);
    } catch {
      addToast("Error al cargar el carrito", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

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
      addToast(body.error ?? "No se pudo actualizar la cantidad", "danger");
      return;
    }
    setCart(body);
  }

  // Eliminar item
  async function removeItem(itemId: string) {
    const res = await fetch(`/api/shop/cart?itemId=${itemId}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      addToast(body.error ?? "No se pudo eliminar el item", "danger");
      return;
    }
    setCart(body);
    addToast("Producto eliminado del carrito", "success");
  }

  // Vaciar carrito
  async function clearCart() {
    const res = await fetch("/api/shop/cart?clear=1", { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      addToast(body.error ?? "No se pudo vaciar el carrito", "danger");
      return;
    }
    setCart(body);
    addToast("Carrito vaciado", "success");
  }

  // Checkout: confirmar desde modal
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
        `Compra realizada. ${body.ordersCreated} producto${body.ordersCreated > 1 ? "s" : ""} pagado${body.ordersCreated > 1 ? "s" : ""}. Nuevo saldo: ${body.newBalance} SHPT`,
        "success",
      );

      setTimeout(() => {
        router.push("/dashboard/student/shop/orders");
      }, 1500);
    } catch {
      addToast("Error al procesar el pago", "danger");
      setCheckingOut(false);
    }
  }

  // Mapear items del carrito para el modal de confirmación
  const purchaseItems: PurchaseItem[] = cart?.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.price,
    imageUrl: item.imageUrl,
    category: item.category,
    color: item.color,
    variantLabel: item.variantLabel,
  })) ?? [];

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/student/shop" label="Volver a la tienda" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Mi carrito</h1>
        {!isEmpty && (
          <Button variant="ghost" size="sm" onClick={clearCart}>
            Vaciar carrito
          </Button>
        )}
      </div>

      {isEmpty ? (
        <Card className="py-12 text-center">
          <p className="text-text-muted">Tu carrito esta vacio.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/dashboard/student/shop")}
          >
            Ir a la tienda
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* ── Lista de items ── */}
          {cart.items.map((item) => (
            <Card key={item.id} className="flex items-center gap-4">
              {/* Imagen */}
              <div className="h-20 w-20 shrink-0 rounded-lg bg-primary/5 p-2">
                <ProductImage
                  imageUrl={item.imageUrl}
                  name={item.name}
                  category={item.category}
                  className="h-full w-full object-contain"
                  emojiSize="md"
                />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text line-clamp-2">{item.name}</p>
                <p className="text-sm text-text-muted">
                  {item.variantLabel ?? item.color ?? ""} · {item.price} SHPT/ud.
                </p>
              </div>

              {/* Selector de cantidad */}
              <QuantitySelector
                value={item.quantity}
                onChange={(q) => updateQuantity(item.id, q)}
                min={1}
                max={item.stock}
                size="sm"
              />

              {/* Subtotal */}
              <div className="w-24 text-right">
                <p className="font-semibold text-text">{item.subtotal} SHPT</p>
              </div>

              {/* Eliminar */}
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="shrink-0 rounded-md p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                aria-label="Eliminar producto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </Card>
          ))}

          {/* ── Resumen ── */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-text">
                Total ({cart.items.reduce((a, i) => a + i.quantity, 0)} {cart.items.reduce((a, i) => a + i.quantity, 0) === 1 ? "unidad" : "unidades"})
              </p>
              <p className="text-xl font-bold text-primary">{cart.total} SHPT</p>
            </div>

            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={checkingOut}
              loading={checkingOut}
              className="w-full"
              size="lg"
            >
              {checkingOut ? "Procesando..." : "Finalizar compra"}
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/student/shop")}
              className="w-full"
            >
              &larr; Seguir comprando
            </Button>
          </Card>
        </div>
      )}

      {/* ── Modal de confirmación ── */}
      <PurchaseConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmCheckout}
        items={purchaseItems}
        balance={balance}
        loading={checkingOut}
      />
    </div>
  );
}
