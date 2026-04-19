"use client";

/**
 * Detalle de un producto de la tienda.
 *
 * Layout:
 * - Izquierda (50%): Imagen grande + miniaturas de variantes
 * - Derecha (50%): Ficha con nombre, descripción, color, precio,
 *   stock, selector de cantidad + botones carrito/comprar
 *
 * Flujos:
 * - "Añadir al carrito" → toast + redirige al catálogo
 * - "Comprar ahora"     → modal confirmación → overlay animado → detalle pedido
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { useCart } from "@/contexts/CartContext";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { DetailField } from "@/components/shared/DetailField";
import { PurchaseOverlay } from "@/components/shared/PurchaseOverlay";
import { PurchaseConfirmModal } from "@/components/shared/PurchaseConfirmModal";
import { ProductImage } from "@/components/shared/ProductImage";
import { ColorSwatchRow } from "@/components/shared/ColorSwatchRow";

interface ProductVariant {
  id: string;
  productId: number;
  name: string;
  color: string;
  variantLabel: string | null;
  price: number;
  stock: number;
  category: string | null;
  imageUrl: string | null;
}

interface ProductGroup {
  groupKey: string;
  name: string;
  category: string | null;
  description: string | null;
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

  // Estado del modal de confirmación
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Estado del overlay de compra
  const [purchaseState, setPurchaseState] = useState<{
    active: boolean;
    promise: Promise<string | null> | null;
  }>({ active: false, promise: null });

  // Carga inicial
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

  // Variante seleccionada
  const selectedVariant = useMemo(
    () => group?.variants.find((v) => v.id === selectedVariantId) ?? group?.variants[0] ?? null,
    [group, selectedVariantId],
  );

  // Reset cantidad al cambiar de variante
  useEffect(() => {
    setQuantity(1);
  }, [selectedVariantId]);

  // Precio total según cantidad
  const totalPrice = selectedVariant ? selectedVariant.price * quantity : 0;

  // ── Añadir al carrito ──
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

  // ── Compra directa: abrir modal ──
  function handleBuyNowClick() {
    setConfirmOpen(true);
  }

  // ── Compra directa: confirmar desde el modal ──
  async function handleConfirmPurchase() {
    if (!selectedVariant) return;
    setConfirmLoading(true);
    setConfirmOpen(false);

    // Una sola llamada con quantity — crea batch + auto-deliver
    const purchasePromise = (async () => {
      const res = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedVariant.id, quantity }),
      });

      const body = await res.json();
      if (!res.ok) {
        addToast(body.error ?? "Error al realizar la compra", "danger");
        return null;
      }
      return body.batchId as string;
    })();

    setPurchaseState({ active: true, promise: purchasePromise });
    setConfirmLoading(false);
  }

  // Cuando termina el overlay → redirigir al detalle del ticket
  const handlePurchaseComplete = useCallback((batchId: string | null) => {
    if (batchId) {
      addToast("Compra realizada correctamente", "success");
      // No desactivamos el overlay — se mantiene visible hasta que
      // router.replace() desmonte este componente al navegar
      router.replace(`/student/shop/orders/batch/${batchId}`);
    } else {
      setPurchaseState({ active: false, promise: null });
    }
  }, [router, addToast]);

  // ── Loading ──
  if (loading) return <SkeletonPage />;

  // ── Producto no encontrado ──
  if (!group || !selectedVariant) {
    return (
      <div className="space-y-6">
        <BackLink href="/student/shop" label="Volver a la tienda" />
        <p className="text-text-muted">Producto no encontrado.</p>
      </div>
    );
  }

  // ── Overlay de compra ──
  if (purchaseState.active && purchaseState.promise) {
    return (
      <PurchaseOverlay
        productName={selectedVariant.name}
        purchasePromise={purchaseState.promise}
        onComplete={handlePurchaseComplete}
      />
    );
  }

  const isOutOfStock = selectedVariant.stock <= 0;

  return (
    <div className="space-y-6">
      <BackLink href="/student/shop" label="Volver a la tienda" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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

        {/* ── Columna derecha: Información ── */}
        <Card className="space-y-5">
          {/* Categoría */}
          {selectedVariant.category && (
            <Badge variant="neutral">{selectedVariant.category}</Badge>
          )}

          {/* Nombre */}
          <h1 className="text-2xl font-bold text-text">{group.name}</h1>

          {/* Descripción */}
          {group.description && (
            <p className="text-text-muted leading-relaxed">{group.description}</p>
          )}

          {/* Selector de color */}
          {group.variants.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text">
                Color: <span className="text-text-muted">{selectedVariant.variantLabel ?? selectedVariant.color}</span>
              </p>
              <ColorSwatchRow
                variants={group.variants}
                selectedId={selectedVariantId}
                onSelect={setSelectedVariantId}
                size="md"
              />
            </div>
          )}

          <div className="border-t border-border-default" />

          {/* Detalles del producto */}
          <div className="space-y-3">
            <DetailField
              label="Precio unitario"
              value={
                <span className="text-xl font-bold text-primary">{selectedVariant.price} ShopTokens</span>
              }
            />
            <DetailField
              label="Disponibilidad"
              value={
                isOutOfStock ? (
                  <Badge variant="danger">Agotado</Badge>
                ) : (
                  <span className="text-text">{selectedVariant.stock} unidades disponibles</span>
                )
              }
            />
          </div>

          <div className="border-t border-border-default" />

          {/* Selector de cantidad */}
          {!isOutOfStock && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text">Cantidad</p>
              <div className="flex items-center gap-4">
                <QuantitySelector
                  value={quantity}
                  onChange={setQuantity}
                  min={1}
                  max={selectedVariant.stock}
                  size="md"
                />
                {quantity > 1 && (
                  <span className="text-sm text-text-muted">
                    Total: <span className="font-semibold text-primary">{totalPrice} ShopTokens</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={handleAddToCart}
              disabled={isOutOfStock || addingToCart}
              loading={addingToCart}
              className="w-full"
              variant="secondary"
            >
              {isOutOfStock ? "Sin stock" : "Añadir al carrito"}
            </Button>

            <Button
              onClick={handleBuyNowClick}
              disabled={isOutOfStock}
              className="w-full"
            >
              {isOutOfStock ? "Sin stock" : "Comprar ahora"}
            </Button>
          </div>
        </Card>
      </div>

      {/* ── Modal de confirmación de compra ── */}
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
