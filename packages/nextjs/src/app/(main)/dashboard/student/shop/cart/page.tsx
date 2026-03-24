"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ProductImage } from "@/components/shared/ProductImage";
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

export default function StudentCartPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [cart, setCart] = useState<CartPayload | null>(null);

  const loadCart = useCallback(async () => {
    try {
      const res = await fetch("/api/shop/cart");
      const body = await res.json();
      if (!res.ok) {
        addToast(body.error ?? "Error al cargar el carrito", "danger");
        return;
      }
      setCart(body);
    } catch {
      addToast("Error al cargar el carrito", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  async function updateQuantity(itemId: string, quantity: number) {
    if (quantity < 1) return;

    const res = await fetch("/api/shop/cart", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, quantity }),
    });

    const body = await res.json();
    if (!res.ok) {
      addToast(body.error ?? "No se pudo actualizar la cantidad", "danger");
      return;
    }

    setCart(body);
  }

  async function removeItem(itemId: string) {
    const res = await fetch(`/api/shop/cart?itemId=${itemId}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      addToast(body.error ?? "No se pudo eliminar el item", "danger");
      return;
    }

    setCart(body);
    addToast("Item eliminado", "success");
  }

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

  async function handleCheckout() {
    setCheckingOut(true);
    try {
      const res = await fetch("/api/shop/checkout", { method: "POST" });
      const body = await res.json();

      if (!res.ok) {
        addToast(body.error ?? "Error en el pago", "danger");
        setCheckingOut(false);
        return;
      }

      addToast(
        `¡Compra realizada! ${body.ordersCreated} producto${body.ordersCreated > 1 ? "s" : ""} pagado${body.ordersCreated > 1 ? "s" : ""}. Nuevo saldo: ${body.newBalance} SHPT`,
        "success"
      );

      // Redirigir a pedidos después de completar el checkout
      setTimeout(() => {
        router.push("/dashboard/student/shop/orders");
      }, 1500);
    } catch {
      addToast("Error al procesar el pago", "danger");
      setCheckingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/student/shop" label="Volver a la tienda" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Mi carrito</h1>
        <Button variant="outline" onClick={clearCart} disabled={!cart || cart.items.length === 0}>
          Vaciar carrito
        </Button>
      </div>

      {!cart || cart.items.length === 0 ? (
        <Card>
          <p className="text-text-muted">Tu carrito esta vacio.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {cart.items.map((item) => (
            <Card key={item.id} className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-lg bg-primary/5 p-2">
                <ProductImage
                  imageUrl={item.imageUrl}
                  name={item.name}
                  category={item.category}
                  className="h-full w-full object-contain"
                  emojiSize="md"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text line-clamp-2">{item.name}</p>
                <p className="text-sm text-text-muted">
                  {item.variantLabel ?? item.color ?? "Variante"} · {item.price} SHPT
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                >
                  -
                </Button>
                <span className="w-8 text-center text-sm">{item.quantity}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  disabled={item.quantity >= item.stock}
                >
                  +
                </Button>
              </div>

              <div className="w-24 text-right font-semibold text-text">{item.subtotal} SHPT</div>

              <Button variant="ghost" onClick={() => removeItem(item.id)}>
                Quitar
              </Button>
            </Card>
          ))}

          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-border-default pb-4">
              <p className="text-lg font-semibold text-text">Total</p>
              <p className="text-xl font-bold text-primary">{cart.total} SHPT</p>
            </div>

            <Button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="w-full"
              size="lg"
            >
              {checkingOut ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Procesando...
                </>
              ) : (
                "Finalizar compra"
              )}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
