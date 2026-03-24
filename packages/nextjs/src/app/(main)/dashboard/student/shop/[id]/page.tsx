"use client";

/**
 * Detalle de un producto de la tienda.
 *
 * Layout:
 * - Izquierda (50%): Imagen grande del producto con miniaturas de color debajo
 * - Derecha (50%): Ficha con nombre, descripción, selector de color,
 *   precio, stock, saldo + botones comprar/carrito
 *
 * Al cambiar de color, la imagen y los datos se actualizan sin cambiar de página.
 * Al comprar: overlay animado → redirect al detalle del pedido.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
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

  const [group, setGroup] = useState<ProductGroup | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Estado de compra
  const [purchaseState, setPurchaseState] = useState<{
    active: boolean;
    promise: Promise<string | null> | null;
  }>({ active: false, promise: null });

  // Carga inicial: todos los productos agrupados + balance, luego buscar el grupo del ID actual
  useEffect(() => {
    if (!id) return;

    Promise.all([
      fetch("/api/shop/products").then((r) => r.json()),
      fetch(`/api/shop/products/${id}`).then((r) => r.json()),
      fetch("/api/shop/balance").then((r) => r.json()),
    ])
      .then(([allGroups, singleProduct, balanceData]) => {
        setBalance(balanceData.balance ?? 0);

        // Buscar el grupo que contiene este producto
        const groups = Array.isArray(allGroups) ? allGroups : [];
        const matchedGroup = groups.find((g: ProductGroup) =>
          g.variants.some((v: ProductVariant) => v.id === id),
        );

        if (matchedGroup) {
          setGroup(matchedGroup);
          setSelectedVariantId(id);
        } else if (singleProduct && singleProduct.id) {
          // Producto sin grupo (sin variantes) — crear grupo artificial
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
  }, [id]);

  // Variante seleccionada actualmente
  const selectedVariant = useMemo(
    () => group?.variants.find((v) => v.id === selectedVariantId) ?? group?.variants[0] ?? null,
    [group, selectedVariantId],
  );

  // Ejecutar compra
  function handlePurchase() {
    if (!selectedVariant) return;

    const purchasePromise = fetch("/api/shop/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: selectedVariant.id }),
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
    if (!selectedVariant) return;

    try {
      const res = await fetch("/api/shop/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedVariant.id, quantity: 1 }),
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

  if (!group || !selectedVariant) {
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
        productName={selectedVariant.name}
        purchasePromise={purchaseState.promise}
        onComplete={handlePurchaseComplete}
      />
    );
  }

  const canBuy = selectedVariant.stock > 0 && balance >= selectedVariant.price;
  const insufficientBalance = balance < selectedVariant.price;

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/student/shop" label="Volver a la tienda" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Columna izquierda: Imagen + miniaturas de color */}
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

          {/* Miniaturas de variantes debajo de la imagen */}
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

        {/* Columna derecha: Información */}
        <Card className="space-y-5">
          {/* Categoría */}
          {selectedVariant.category && (
            <Badge variant="neutral">{selectedVariant.category}</Badge>
          )}

          {/* Nombre del grupo */}
          <h1 className="text-2xl font-bold text-text">{group.name}</h1>

          {/* Descripción */}
          {group.description && (
            <p className="text-text-muted leading-relaxed">{group.description}</p>
          )}

          {/* Selector de color con círculos */}
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

          {/* Detalles */}
          <div className="space-y-3">
            <DetailField
              label="Precio"
              value={
                <span className="text-xl font-bold text-primary">{selectedVariant.price} SHPT</span>
              }
            />
            <DetailField
              label="Stock disponible"
              value={
                selectedVariant.stock > 0 ? (
                  <span>{selectedVariant.stock} unidades</span>
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

          {/* Botones de compra */}
          <div className="space-y-3">
            <Button
              onClick={handleAddToCart}
              disabled={selectedVariant.stock <= 0}
              className="w-full"
              variant="secondary"
            >
              {selectedVariant.stock <= 0 ? "Sin stock" : "Agregar al carrito"}
            </Button>

            <Button
              onClick={handlePurchase}
              disabled={!canBuy}
              className="w-full"
            >
              {selectedVariant.stock <= 0
                ? "Sin stock"
                : insufficientBalance
                  ? `Saldo insuficiente (necesitas ${selectedVariant.price} SHPT)`
                  : `Comprar por ${selectedVariant.price} SHPT`}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
