"use client";

/**
 * Detalle de un producto de la tienda.
 *
 * Layout:
 * - Izquierda (50%): Imagen del producto o fallback
 * - Derecha (50%): Ficha con nombre, descripción, categoría, precio, stock + botón comprar
 *
 * Al comprar: overlay animado → redirect al detalle del pedido.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { DetailField } from "@/components/shared/DetailField";
import { PurchaseOverlay } from "@/components/shared/PurchaseOverlay";
import { ProductImage } from "@/components/shared/ProductImage";

interface Product {
  id: string;
  productId: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: string | null;
  imageUrl: string | null;
  active: boolean;
}

export default function StudentProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Estado de compra
  const [purchaseState, setPurchaseState] = useState<{
    active: boolean;
    promise: Promise<string | null> | null;
  }>({ active: false, promise: null });

  // Carga inicial: producto + balance
  useEffect(() => {
    if (!id) return;

    Promise.all([
      fetch(`/api/shop/products/${id}`).then((r) => r.json()),
      fetch("/api/shop/balance").then((r) => r.json()),
    ])
      .then(([productData, balanceData]) => {
        setProduct(productData);
        setBalance(balanceData.balance ?? 0);
      })
      .catch(() => addToast("Error al cargar el producto", "danger"))
      .finally(() => setLoading(false));
  }, [id]);

  // Ejecutar compra
  function handlePurchase() {
    if (!product) return;

    const purchasePromise = fetch("/api/shop/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id }),
    }).then(async (res) => {
      const body = await res.json();
      if (!res.ok) {
        addToast(body.error ?? "Error al realizar la compra", "danger");
        return null;
      }
      return (body.id as string) ?? null;
    }).catch(() => {
      addToast("Error al realizar la compra", "danger");
      return null;
    });

    setPurchaseState({ active: true, promise: purchasePromise });
  }

  async function handleAddToCart() {
    if (!product) return;

    try {
      const res = await fetch("/api/shop/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });

      const body = await res.json();
      if (!res.ok) {
        addToast(body.error ?? "No se pudo agregar al carrito", "danger");
        return;
      }

      addToast("Producto agregado al carrito", "success");
      router.push("/dashboard/student/shop/cart");
    } catch {
      addToast("No se pudo agregar al carrito", "danger");
    }
  }

  // Cuando termina la compra
  const handlePurchaseComplete = useCallback((orderId: string | null) => {
    setPurchaseState({ active: false, promise: null });
    if (orderId) {
      addToast("Compra realizada correctamente", "success");
      router.replace(`/dashboard/student/shop/orders/${orderId}`);
    }
  }, [router, addToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <BackLink href="/dashboard/student/shop" label="Volver a la tienda" />
        <p className="text-text-muted">Producto no encontrado.</p>
      </div>
    );
  }

  // Overlay de compra
  if (purchaseState.active && purchaseState.promise) {
    return (
      <PurchaseOverlay
        productName={product.name}
        purchasePromise={purchaseState.promise}
        onComplete={handlePurchaseComplete}
      />
    );
  }

  const canBuy = product.stock > 0 && balance >= product.price && product.active;
  const insufficientBalance = balance < product.price;

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/student/shop" label="Volver a la tienda" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Columna izquierda: Imagen */}
        <Card className="flex items-center justify-center p-8 min-h-[300px]">
          <ProductImage
            imageUrl={product.imageUrl}
            name={product.name}
            category={product.category}
            emojiSize="xl"
            className="max-h-[300px] w-auto object-contain"
          />
        </Card>

        {/* Columna derecha: Información */}
        <Card className="space-y-5">
          {/* Categoría */}
          {product.category && (
            <Badge variant="neutral">{product.category}</Badge>
          )}

          {/* Nombre */}
          <h1 className="text-2xl font-bold text-text">{product.name}</h1>

          {/* Descripción */}
          {product.description && (
            <p className="text-text-muted leading-relaxed">{product.description}</p>
          )}

          <div className="border-t border-border-default" />

          {/* Detalles */}
          <div className="space-y-3">
            <DetailField
              label="Precio"
              value={
                <span className="text-xl font-bold text-primary">{product.price} SHPT</span>
              }
            />
            <DetailField
              label="Stock disponible"
              value={
                product.stock > 0 ? (
                  <span>{product.stock} unidades</span>
                ) : (
                  <Badge variant="danger">Agotado</Badge>
                )
              }
            />
            <DetailField
              label="Tu saldo"
              value={
                <span className={insufficientBalance ? "text-danger font-medium" : ""}>
                  {balance} SHPT
                  {insufficientBalance && " (insuficiente)"}
                </span>
              }
            />
          </div>

          <div className="border-t border-border-default" />

          {/* Botón de compra */}
          <div className="space-y-3">
            <Button
              onClick={handleAddToCart}
              disabled={product.stock <= 0 || !product.active}
              className="w-full"
              variant="secondary"
            >
              {product.stock <= 0 ? "Sin stock" : "Agregar al carrito"}
            </Button>

            <Button
              onClick={handlePurchase}
              disabled={!canBuy}
              className="w-full"
            >
              {product.stock <= 0
                ? "Sin stock"
                : insufficientBalance
                  ? `Saldo insuficiente (necesitas ${product.price} SHPT)`
                  : `Comprar por ${product.price} SHPT`}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
