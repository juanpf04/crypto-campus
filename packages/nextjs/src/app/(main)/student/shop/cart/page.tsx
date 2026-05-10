"use client";

/**
 * Carrito de la tienda del estudiante.
 *
 * Page fina que orquesta fetches y compone los organisms CartItemList +
 * CartSummary + PurchaseConfirmModal.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { PurchaseConfirmModal, type PurchaseItem } from "@/components/shared/PurchaseConfirmModal";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { CartItemList, type CartItemListItem } from "@/components/dashboard/CartItemList";
import { CartSummary } from "@/components/dashboard/CartSummary";
import { useToast } from "@/hooks/useToast";
import { toastRewards } from "@/lib/rewardToast";
import { useCart } from "@/contexts/CartContext";

interface CartItem extends CartItemListItem {
  productId: string;
}

interface CartPayload {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
}

export default function StudentCartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const { setItemCount, startPurchase } = useCart();
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartPayload | null>(null);
  const [balance, setBalance] = useState(0);
  const pendingHandledRef = useRef(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

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
  }, [addToast, setItemCount]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  useEffect(() => {
    const pendingProductId = searchParams.get("pendingProductId");
    if (!pendingProductId || pendingHandledRef.current) {
      return;
    }

    pendingHandledRef.current = true;

    const pendingQtyRaw = Number(searchParams.get("pendingQty") ?? "1");
    const pendingQty = Number.isInteger(pendingQtyRaw) && pendingQtyRaw > 0 ? pendingQtyRaw : 1;

    async function addPendingProduct() {
      try {
        const res = await fetch("/api/shop/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: pendingProductId, quantity: pendingQty }),
        });

        const body = await res.json();
        if (!res.ok) {
          addToast(body.error ?? "No se pudo agregar el producto al carrito", "danger");
        } else {
          setCart(body);
          setItemCount(body.items?.length ?? 0);
          addToast("Producto agregado al carrito", "success");
        }
      } catch {
        addToast("No se pudo agregar el producto al carrito", "danger");
      } finally {
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete("pendingProductId");
        nextParams.delete("pendingQty");
        const query = nextParams.toString();
        router.replace(query ? `/student/shop/cart?${query}` : "/student/shop/cart");
        loadCart();
      }
    }

    addPendingProduct();
  }, [addToast, loadCart, router, searchParams, setItemCount]);

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

  async function confirmClearCart() {
    setClearing(true);
    try {
      const res = await fetch("/api/shop/cart?clear=1", { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        addToast(body.error ?? "No se pudo vaciar el carrito", "danger");
        return;
      }
      setCart(body);
      setItemCount(0);
      addToast("Carrito vaciado", "success");
      setClearOpen(false);
    } finally {
      setClearing(false);
    }
  }

  function handleConfirmCheckout() {
    setConfirmOpen(false);

    // Vaciamos el carrito local antes de mostrar el overlay para que, al
    // volver a la tienda, no se vea el carrito "lleno" un instante.
    const itemNames = cart?.items.map((i) => i.name) ?? [];
    setCart(null);
    setItemCount(0);

    const overlayName =
      itemNames.length <= 2
        ? itemNames.join(", ")
        : `${itemNames[0]} y ${itemNames.length - 1} más`;

    let failed = false;
    const checkoutPromise = (async () => {
      try {
        const res = await fetch("/api/shop/checkout", { method: "POST" });
        const body = await res.json();
        if (!res.ok) {
          failed = true;
          addToast(body.error ?? "Error en el pago", "danger");
          return null;
        }
        toastRewards(addToast, body.rewards);
        return (body.batchId as string) ?? null;
      } catch {
        failed = true;
        addToast("Error al procesar el pago", "danger");
        return null;
      }
    })();

    // Si la promise falla muy rápido (ej. módulo pausado), no mostramos el
    // overlay — el toast de error ya informa al usuario.
    setTimeout(() => {
      if (failed) return;
      startPurchase(checkoutPromise, overlayName);
    }, 400);
  }

  const purchaseItems: PurchaseItem[] = cart?.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.price,
    imageUrl: item.imageUrl,
    category: item.category,
    color: item.color,
    variantLabel: item.variantLabel,
  })) ?? [];

  if (loading) return <SkeletonPage />;

  const isEmpty = !cart || cart.items.length === 0;
  const totalUnits = cart?.items.reduce((a, i) => a + i.quantity, 0) ?? 0;

  return (
    <div className="space-y-6">
      <BackLink href="/student/shop" label="Volver a la tienda" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Mi carrito</h1>
        {!isEmpty && (
          <Button variant="danger" size="sm" onClick={() => setClearOpen(true)}>
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
            onClick={() => router.push("/student/shop")}
          >
            Ir a la tienda
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          <CartItemList
            items={cart.items}
            onUpdateQuantity={updateQuantity}
            onRemove={removeItem}
          />

          <CartSummary
            totalUnits={totalUnits}
            totalPrice={cart.total}
            onContinueShopping={() => router.push("/student/shop")}
            onCheckout={() => setConfirmOpen(true)}
            checkingOut={false}
          />
        </div>
      )}

      <PurchaseConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmCheckout}
        items={purchaseItems}
        balance={balance}
        loading={false}
      />

      <ConfirmModal
        open={clearOpen}
        onClose={() => { if (!clearing) setClearOpen(false); }}
        onConfirm={confirmClearCart}
        title="Vaciar carrito"
        description="Se eliminarán todos los productos del carrito. Tendrás que volver a añadirlos si quieres comprarlos."
        confirmLabel="Vaciar"
        loading={clearing}
      />
    </div>
  );
}
