"use client";

/**
 * Detalle de producto (admin).
 *
 * Page fina que carga el grupo (con fallbacks por groupKey / variant id) y
 * compone los organisms ProductAdminHeader + VariantDetailCard + VariantGrid.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { ProductImage } from "@/components/shared/ProductImage";
import { ColorSwatchRow } from "@/components/shared/ColorSwatchRow";
import { InactiveAlert } from "@/components/shared/InactiveAlert";
import { ProductAdminHeader } from "@/components/dashboard/ProductAdminHeader";
import { VariantDetailCard } from "@/components/dashboard/VariantDetailCard";
import { VariantGrid } from "@/components/dashboard/VariantGrid";
import { ConfirmModal } from "@/components/shared/ConfirmModal";

interface ProductVariant {
  id: string;
  productId: number;
  name: string;
  color: string;
  variantLabel: string | null;
  price: number;
  stock: number;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
}

interface ProductGroupDetail {
  groupKey: string;
  name: string;
  category: string | null;
  description: string | null;
  active: boolean;
  totalStock: number;
  minPrice: number;
  maxPrice: number;
  activeVariantsCount: number;
  variants: ProductVariant[];
}

export default function AdminProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [group, setGroup] = useState<ProductGroupDetail | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // Confirmación de toggle: del grupo entero o de una variante individual
  const [pendingToggle, setPendingToggle] = useState<
    | { kind: "group"; currentlyActive: boolean }
    | { kind: "variant"; variantId: string; variantName: string; currentlyActive: boolean }
    | null
  >(null);

  // El [id] puede ser un groupKey o un variant prisma ID.
  // No depende de selectedVariantId para evitar refetches en cada click de variante.
  const loadGroup = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    try {
      const groupRes = await fetch(`/api/shop/products/groups/${id}`);
      if (groupRes.ok) {
        const data = await groupRes.json();
        if (data.variants) {
          setGroup(data);
          return;
        }
      }

      const productRes = await fetch(`/api/shop/products/${id}`);
      if (productRes.ok) {
        const product = await productRes.json();
        if (product.base?.slug) {
          const groupBySlug = await fetch(`/api/shop/products/groups/${product.base.slug}`);
          if (groupBySlug.ok) {
            const data = await groupBySlug.json();
            setGroup(data);
            // El id de la URL es un variant; lo preseleccionamos.
            setSelectedVariantId(id);
            return;
          }
        }
      }

      // Fallback: buscar en todos los grupos
      const allRes = await fetch("/api/shop/products/admin");
      if (!allRes.ok) throw new Error("Error al cargar productos");

      const groups = await allRes.json();
      const list = Array.isArray(groups) ? groups : [];

      interface VariantLike { id: string }
      interface GroupLike { groupKey: string; variants: VariantLike[] }
      const matched = list.find((g: GroupLike) => g.variants?.some((v: VariantLike) => v.id === id));
      if (!matched) throw new Error("Producto no encontrado");

      const finalRes = await fetch(`/api/shop/products/groups/${matched.groupKey}`);
      if (!finalRes.ok) throw new Error("Error al cargar grupo");

      const data = await finalRes.json();
      setGroup(data);
      setSelectedVariantId(id);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al cargar producto", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  // Sincroniza la selección cuando el grupo carga: si no hay variante seleccionada
  // (o ya no existe en el grupo), cae a la primera. La condición evita el bucle
  // porque tras el setState, la nueva selección sí es válida y el if no entra.
  useEffect(() => {
    if (!group) return;
    if (!selectedVariantId || !group.variants.some((v) => v.id === selectedVariantId)) {
      setSelectedVariantId(group.variants[0]?.id ?? "");
    }
  }, [group, selectedVariantId]);

  const selectedVariant = useMemo(() => {
    if (!group) return null;
    return group.variants.find((v) => v.id === selectedVariantId) ?? group.variants[0];
  }, [group, selectedVariantId]);

  // Pide confirmación para togglear el grupo entero (afecta todas las variantes)
  const requestToggleGroup = useCallback(() => {
    if (!group) return;
    setPendingToggle({ kind: "group", currentlyActive: group.active });
  }, [group]);

  // Pide confirmación para togglear una variante individual
  const requestToggleVariant = useCallback((variantId: string, currentActive: boolean) => {
    if (!group) return;
    const variant = group.variants.find((v) => v.id === variantId);
    if (!variant) return;
    setPendingToggle({
      kind: "variant",
      variantId,
      variantName: variant.variantLabel || variant.color || variant.name,
      currentlyActive: currentActive,
    });
  }, [group]);

  // Tras confirmar, ejecuta el PATCH apropiado
  const confirmToggle = useCallback(async () => {
    if (!pendingToggle || !group) return;

    if (pendingToggle.kind === "group") {
      const newActive = !pendingToggle.currentlyActive;
      setToggling("group");
      try {
        const res = await fetch(`/api/shop/products/groups/${group.groupKey}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: newActive }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "Error");
        }
        await loadGroup();
        addToast(
          newActive
            ? `${group.name} reactivado (todas las variantes)`
            : `${group.name} desactivado (todas las variantes)`,
          "success",
        );
        setPendingToggle(null);
      } catch (err) {
        addToast(err instanceof Error ? err.message : "Error", "danger");
      } finally {
        setToggling(null);
      }
    } else {
      const { variantId, currentlyActive } = pendingToggle;
      setToggling(variantId);
      try {
        const res = await fetch(`/api/shop/products/variants/${variantId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !currentlyActive }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "Error");
        }
        await loadGroup();
        addToast(
          currentlyActive ? "Variante desactivada" : "Variante reactivada",
          "success",
        );
        setPendingToggle(null);
      } catch (err) {
        addToast(err instanceof Error ? err.message : "Error", "danger");
      } finally {
        setToggling(null);
      }
    }
  }, [pendingToggle, group, loadGroup, addToast]);

  if (loading) return <SkeletonPage />;

  if (!group || !selectedVariant) {
    return (
      <div className="space-y-6">
        <BackLink href="/admin/shop/products" label="Volver a productos" />
        <p className="text-text-muted">Producto no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href="/admin/shop/products" label="Volver a productos" />

      {!group.active && (
        <InactiveAlert
          resourceName={group.name}
          actionLabel="Reactivar grupo"
          onAction={requestToggleGroup}
          loading={toggling === "group"}
        />
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
        {/* Columna izquierda: imagen + selector de colores */}
        <Card className="flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-sm">
            <ProductImage
              imageUrl={selectedVariant.imageUrl}
              name={selectedVariant.name}
              category={group.category}
              emojiSize="lg"
              className="w-full h-72 object-contain"
            />
          </div>

          {group.variants.length > 1 && (
            <div className="mt-6 w-full">
              <p className="text-sm font-medium text-text-muted mb-2">
                Variantes ({group.variants.length} colores)
              </p>
              <ColorSwatchRow
                variants={group.variants}
                selectedId={selectedVariantId}
                onSelect={setSelectedVariantId}
                maxVisible={12}
              />
            </div>
          )}
        </Card>

        {/* Columna derecha: header del grupo + variante seleccionada */}
        <div className="space-y-5">
          <ProductAdminHeader
            groupKey={group.groupKey}
            name={group.name}
            description={group.description}
            category={group.category}
            active={group.active}
            totalStock={group.totalStock}
            minPrice={group.minPrice}
            maxPrice={group.maxPrice}
            activeVariantsCount={group.activeVariantsCount}
            totalVariants={group.variants.length}
            toggling={toggling === "group"}
            onEdit={() => router.push(`/admin/shop/products/${group.groupKey}/edit-group`)}
            onToggleActive={requestToggleGroup}
          />

          <VariantDetailCard
            productId={selectedVariant.productId}
            name={selectedVariant.name}
            color={selectedVariant.color}
            variantLabel={selectedVariant.variantLabel}
            price={selectedVariant.price}
            stock={selectedVariant.stock}
            active={selectedVariant.active}
            toggling={toggling === selectedVariant.id}
            onEdit={() => router.push(`/admin/shop/products/variants/${selectedVariant.id}/edit?from=detail&group=${group.groupKey}`)}
            onToggleActive={() => requestToggleVariant(selectedVariant.id, selectedVariant.active)}
          />
        </div>
      </div>

      <VariantGrid
        variants={group.variants}
        category={group.category}
        selectedVariantId={selectedVariantId}
        toggling={toggling}
        onSelect={setSelectedVariantId}
        onEditVariant={(variantId) => router.push(`/admin/shop/products/variants/${variantId}/edit?from=detail&group=${group.groupKey}`)}
        onToggleVariant={requestToggleVariant}
        onAddVariant={() => router.push(`/admin/shop/products/${group.groupKey}/add-variant`)}
      />

      <ConfirmModal
        open={pendingToggle !== null}
        onClose={() => { if (toggling === null) setPendingToggle(null); }}
        onConfirm={confirmToggle}
        title={
          pendingToggle?.kind === "group"
            ? (pendingToggle.currentlyActive ? "Desactivar producto" : "Reactivar producto")
            : (pendingToggle?.currentlyActive ? "Desactivar variante" : "Reactivar variante")
        }
        description={
          pendingToggle?.kind === "group"
            ? (pendingToggle.currentlyActive
                ? `"${group.name}" y sus ${group.variants.length} variante${group.variants.length !== 1 ? "s" : ""} dejarán de estar disponibles en la tienda. ¿Quieres continuar?`
                : `"${group.name}" y todas sus variantes volverán a estar disponibles en la tienda. ¿Quieres continuar?`)
            : pendingToggle?.kind === "variant"
              ? (pendingToggle.currentlyActive
                  ? `La variante "${pendingToggle.variantName}" dejará de estar disponible para nuevas compras. ¿Quieres continuar?`
                  : `La variante "${pendingToggle.variantName}" volverá a estar disponible para compras. ¿Quieres continuar?`)
              : ""
        }
        confirmLabel={pendingToggle?.currentlyActive ? "Desactivar" : "Reactivar"}
        loading={toggling !== null}
      />
    </div>
  );
}
