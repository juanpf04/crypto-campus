"use client";

/**
 * Detalle de un producto de la tienda.
 *
 * Layout: imagen + miniaturas (izq) + ProductDetailPanel (der).
 * Orquesta fetches (grupos, balance, carrito, compra directa) y el overlay.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { useCart } from "@/contexts/CartContext";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { PurchaseOverlay } from "@/components/shared/PurchaseOverlay";
import { PurchaseConfirmModal } from "@/components/shared/PurchaseConfirmModal";
import { ProductImage } from "@/components/shared/ProductImage";
import {
  ProductDetailPanel,
  type ProductDetailGroup,
  type ProductDetailVariant,
} from "@/components/dashboard/ProductDetailPanel";

interface ProductVariant extends ProductDetailVariant {
  productId: number;
}

interface ProductGroup extends ProductDetailGroup {
  groupKey: string;
  category: string | null;
  variants: ProductVariant[];
}

export default function StudentProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const { openCart } = useCart();

  const [group, setGroup] = useState<ProductGroup | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [purchaseState, setPurchaseState] = useState<{
    active: boolean;
    promise: Promise<string | null> | null;
  }>({ active: false, promise: null });

  useEffect(() => {
    if (!id) return;

    Promise.all([
      fetch("/api/shop/products").then((r) => r.json()),
      fetch(`/api/shop/products/${id}`).then((r) => r.json()),
      fetch("/api/shop/balance").then((r) => r.json()),
    ])
      .then(([allGroups, singleProduct, balanceData]) => {
        setBalance(balanceData.balance ?? 0);

        const groups = Array.isArray(allGroups) ? allGroups : [];
        const matchedGroup = groups.find((g: ProductGroup) =>
          g.variants.some((v: ProductVariant) => v.id === id),
        );

        if (matchedGroup) {
          setGroup(matchedGroup);
          setSelectedVariantId(id);
        } else if (singleProduct && singleProduct.id) {
          setGroup({
            groupKey: singleProduct.id,
            name: singleProduct.name,
            category: singleProduct.category,
            description: singleProduct.description,
            variants: [{
              id: singleProduct.id,
              productId: singleProduct.productId,
              name: singleProduct.name,
              color: "",
              variantLabel: null,
              price: singleProduct.price,
              stock: singleProduct.stock,
              category: singleProduct.category,
              imageUrl: singleProduct.imageUrl,
            }],
          });
          setSelectedVariantId(singleProduct.id);
        }
      })
      .catch(() => addToast("Error al cargar el producto", "danger"))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  const selectedVariant = useMemo(
    () => group?.variants.find((v) => v.id === selectedVariantId) ?? group?.variants[0] ?? null,
    [group, selectedVariantId],
  );

  useEffect(() => {
    setQuantity(1);
  }, [selectedVariantId]);

  async function handleAddToCart() {
    if (!selectedVariant) return;
    setAddingToCart(true);

    try {
      const res = await fetch("/api/shop/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedVariant.id, quantity }),
      });

      const body = await res.json();
      if (!res.ok) {
        addToast(body.error ?? "No se pudo agregar al carrito", "danger");
        return;
      }

      addToast(
        `${quantity} ${quantity === 1 ? "unidad añadida" : "unidades añadidas"} al carrito`,
        "success",
      );
      openCart();
    } catch {
      addToast("No se pudo agregar al carrito", "danger");
    } finally {
      setAddingToCart(false);
    }
  }

  async function handleConfirmPurchase() {
    if (!selectedVariant) return;
    setConfirmLoading(true);
    setConfirmOpen(false);

    let failed = false;
    const purchasePromise = (async () => {
      const res = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedVariant.id, quantity }),
      });

      const body = await res.json();
      if (!res.ok) {
        failed = true;
        addToast(body.error ?? "Error al realizar la compra", "danger");
        return null;
      }
      return body.batchId as string;
    })();

    // Si la compra falla rápido (ej. módulo pausado), no mostramos el
    // overlay — el toast de error ya informa al usuario.
    setTimeout(() => {
      if (failed) return;
      setPurchaseState({ active: true, promise: purchasePromise });
    }, 400);
    setConfirmLoading(false);
  }

  const handlePurchaseComplete = useCallback((batchId: string | null) => {
    if (batchId) {
      addToast("Compra realizada correctamente", "success");
      router.replace(`/student/shop/orders/batch/${batchId}`);
    } else {
      setPurchaseState({ active: false, promise: null });
    }
  }, [router, addToast]);

  if (loading) return <SkeletonPage />;

  if (!group || !selectedVariant) {
    return (
      <div className="space-y-6">
        <BackLink href="/student/shop" label="Volver a la tienda" />
        <p className="text-text-muted">Producto no encontrado.</p>
      </div>
    );
  }

  if (purchaseState.active && purchaseState.promise) {
    return (
      <PurchaseOverlay
        productName={selectedVariant.name}
        purchasePromise={purchaseState.promise}
        onComplete={handlePurchaseComplete}
      />
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href="/student/shop" label="Volver a la tienda" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-center">
        {/* ── Columna izquierda: Imagen + miniaturas ── */}
        <div className="space-y-4">
          <Card className="flex items-center justify-center p-8 min-h-[300px]">
            <ProductImage
              imageUrl={selectedVariant.imageUrl}
              name={selectedVariant.name}
              category={selectedVariant.category}
              emojiSize="xl"
              className="max-h-[300px] w-auto object-contain"
            />
          </Card>

          {group.variants.length > 1 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {group.variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`rounded-lg border-2 p-1 transition-all ${
                    variant.id === selectedVariantId
                      ? "border-primary ring-1 ring-primary"
                      : "border-border-default hover:border-primary/50"
                  }`}
                >
                  <div className="h-16 w-16 flex items-center justify-center bg-primary/5 rounded">
                    <ProductImage
                      imageUrl={variant.imageUrl}
                      name={variant.name}
                      category={variant.category}
                      emojiSize="md"
                      className="h-full w-full object-contain p-1"
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Columna derecha: Panel de detalle ── */}
        <ProductDetailPanel
          group={group}
          selectedVariant={selectedVariant}
          selectedVariantId={selectedVariantId}
          onSelectVariant={setSelectedVariantId}
          quantity={quantity}
          onQuantityChange={setQuantity}
          onAddToCart={handleAddToCart}
          onBuyNow={() => setConfirmOpen(true)}
          addingToCart={addingToCart}
        />
      </div>

      <PurchaseConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmPurchase}
        loading={confirmLoading}
        balance={balance}
        items={[
          {
            name: selectedVariant.name,
            quantity,
            unitPrice: selectedVariant.price,
            imageUrl: selectedVariant.imageUrl,
            category: selectedVariant.category,
            color: selectedVariant.color,
            variantLabel: selectedVariant.variantLabel,
          },
        ]}
      />
    </div>
  );
}
