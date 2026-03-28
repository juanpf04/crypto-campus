"use client";

/**
 * Detalle de producto para el admin.
 *
 * Carga el grupo completo por groupKey vía API nueva.
 * Dos niveles de gestión:
 * - Grupo: editar nombre/desc/categoría/precio, desactivar/reactivar todo
 * - Variante: editar nombre/color/stock/imagen, desactivar/reactivar individual
 *
 * Layout:
 * - Banner de alerta si está desactivado
 * - Imagen principal + selector de colores
 * - Info del grupo (badges, precio, stats)
 * - Card de variante seleccionada con acciones individuales
 * - Grid de todas las variantes con estado y acciones rápidas
 * - Botón "Añadir variante"
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { ProductImage } from "@/components/shared/ProductImage";
import { ColorSwatchRow } from "@/components/shared/ColorSwatchRow";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { InactiveAlert } from "@/components/shared/InactiveAlert";
import { VariantGridItem } from "@/components/shared/VariantGridItem";
import { icons } from "@/components/ui/icons";

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

  // El [id] puede ser un groupKey o un variant prisma ID.
  // Intentamos primero como groupKey, si falla buscamos por variante
  const loadGroup = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Intentar como groupKey
      let res = await fetch(`/api/shop/products/groups/${id}`);

      if (res.ok) {
        const data = await res.json();
        setGroup(data);
        if (!selectedVariantId || !data.variants.some((v: ProductVariant) => v.id === selectedVariantId)) {
          setSelectedVariantId(data.variants[0]?.id ?? "");
        }
        return;
      }

      // Si no es groupKey, buscar en todos los grupos admin cual contiene esta variante
      res = await fetch("/api/shop/products/admin");
      if (!res.ok) throw new Error("Error al cargar productos");

      const groups = await res.json();
      if (!Array.isArray(groups)) throw new Error("Formato inesperado");

      interface VariantLike { id: string }
      interface GroupLike { groupKey: string; variants: VariantLike[] }
      const matched = groups.find((g: GroupLike) => g.variants.some((v: VariantLike) => v.id === id));
      if (!matched) throw new Error("Producto no encontrado");

      // Cargar el grupo completo
      res = await fetch(`/api/shop/products/groups/${matched.groupKey}`);
      if (!res.ok) throw new Error("Error al cargar grupo");

      const data = await res.json();
      setGroup(data);
      setSelectedVariantId(id);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al cargar producto", "danger");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  const selectedVariant = useMemo(() => {
    if (!group) return null;
    return group.variants.find((v) => v.id === selectedVariantId) ?? group.variants[0];
  }, [group, selectedVariantId]);

  // Toggle grupo completo
  const handleToggleGroup = useCallback(async () => {
    if (!group) return;
    const newActive = !group.active;
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

      // Recargar datos
      await loadGroup();
      addToast(
        newActive
          ? `${group.name} reactivado (todas las variantes)`
          : `${group.name} desactivado (todas las variantes)`,
        "success",
      );
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setToggling(null);
    }
  }, [group, loadGroup, addToast]);

  // Toggle variante individual
  const handleToggleVariant = useCallback(async (variantId: string, currentActive: boolean) => {
    setToggling(variantId);

    try {
      const res = await fetch(`/api/shop/products/variants/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error");
      }

      await loadGroup();
      addToast(
        currentActive ? "Variante desactivada" : "Variante reactivada",
        "success",
      );
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setToggling(null);
    }
  }, [loadGroup, addToast]);

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
        <BackLink href="/dashboard/admin/shop/products" label="Volver a productos" />
        <p className="text-text-muted">Producto no encontrado.</p>
      </div>
    );
  }

  const priceLabel = group.minPrice === group.maxPrice
    ? `${group.minPrice} ShopTokens`
    : `${group.minPrice} - ${group.maxPrice} ShopTokens`;

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/admin/shop/products" label="Volver a productos" />

      {/* Banner producto inactivo */}
      {!group.active && (
        <InactiveAlert
          resourceName={group.name}
          actionLabel="Reactivar todo"
          onAction={handleToggleGroup}
          loading={toggling === "group"}
        />
      )}

      {/* ── Layout principal: imagen + info ── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Imagen + variantes */}
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

        {/* Info del grupo */}
        <div className="space-y-6">
          {/* Badges + título */}
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {group.category && <Badge variant="neutral">{group.category}</Badge>}
              <Badge variant={group.active ? "success" : "danger"}>
                {group.active ? "Activo" : "Inactivo"}
              </Badge>
              <Badge variant="info">
                {group.activeVariantsCount}/{group.variants.length} variantes activas
              </Badge>
            </div>

            <h1 className="text-2xl font-bold text-text">{group.name}</h1>

            {group.description && (
              <p className="text-text-muted mt-2 leading-relaxed">{group.description}</p>
            )}
          </div>

          {/* Precio grande */}
          <div className="text-3xl font-bold text-primary">{priceLabel}</div>

          {/* Stats del grupo en grid */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="text-center py-4">
              <p className="text-2xl font-bold text-text">{group.totalStock}</p>
              <p className="text-xs text-text-muted mt-1">Stock total</p>
            </Card>
            <Card className="text-center py-4">
              <p className="text-2xl font-bold text-text">{group.variants.length}</p>
              <p className="text-xs text-text-muted mt-1">Variantes</p>
            </Card>
            <Card className="text-center py-4">
              <p className="text-2xl font-bold text-text">{group.category ?? "—"}</p>
              <p className="text-xs text-text-muted mt-1">Categoría</p>
            </Card>
          </div>

          {/* Acciones del grupo */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push(`/dashboard/admin/shop/products/${group.groupKey}/edit-group`)}
            >
              Editar grupo
            </Button>
            <Button
              variant={group.active ? "danger" : "primary"}
              className="flex-1"
              onClick={handleToggleGroup}
              loading={toggling === "group"}
            >
              {group.active ? "Desactivar todo" : "Reactivar todo"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Variante seleccionada — detalle + acciones individuales ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Variante seleccionada</SectionTitle>

        <Card className={`${selectedVariant.active ? "bg-primary/5 border-primary/20" : "bg-danger/5 border-danger/20"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-text">{selectedVariant.name}</h3>
              <Badge variant={selectedVariant.active ? "success" : "danger"}>
                {selectedVariant.active ? "Activa" : "Inactiva"}
              </Badge>
            </div>
            <Badge variant="neutral">#{selectedVariant.productId}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
            <div>
              <p className="text-xs text-text-muted">Color</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="inline-block h-4 w-4 rounded-full border border-border-default"
                  style={{ backgroundColor: selectedVariant.color || "#ccc" }}
                />
                <span className="text-sm font-medium text-text">{selectedVariant.color || "—"}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-text-muted">Precio</p>
              <p className="text-sm font-semibold text-primary mt-1">{selectedVariant.price} ShopTokens</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Stock</p>
              <p className="text-sm font-semibold text-text mt-1">{selectedVariant.stock} uds.</p>
            </div>
            {selectedVariant.variantLabel && (
              <div>
                <p className="text-xs text-text-muted">Etiqueta</p>
                <p className="text-sm font-medium text-text mt-1">{selectedVariant.variantLabel}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => router.push(`/dashboard/admin/shop/products/variants/${selectedVariant.id}/edit?from=detail&group=${group.groupKey}`)}
            >
              Editar variante
            </Button>
            <Button
              variant={selectedVariant.active ? "danger" : "primary"}
              size="sm"
              className="flex-1"
              onClick={() => handleToggleVariant(selectedVariant.id, selectedVariant.active)}
              loading={toggling === selectedVariant.id}
            >
              {selectedVariant.active ? "Desactivar" : "Reactivar"}
            </Button>
          </div>
        </Card>
      </section>

      {/* ── Grid de todas las variantes ── */}
      {group.variants.length > 1 && (
        <section className="space-y-4">
          <SectionTitle icon={icons.shop}>Todas las variantes ({group.variants.length})</SectionTitle>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {group.variants.map((v) => (
              <VariantGridItem
                key={v.id}
                id={v.id}
                name={v.name}
                color={v.color}
                price={v.price}
                stock={v.stock}
                imageUrl={v.imageUrl}
                category={group.category}
                active={v.active}
                selected={v.id === selectedVariantId}
                toggling={toggling === v.id}
                onSelect={() => setSelectedVariantId(v.id)}
                onEdit={() => router.push(`/dashboard/admin/shop/products/variants/${v.id}/edit?from=detail&group=${group.groupKey}`)}
                onToggleActive={() => handleToggleVariant(v.id, v.active)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Añadir variante ── */}
      <div className="flex justify-center pt-4">
        <Button
          variant="outline"
          onClick={() => router.push(`/dashboard/admin/shop/products/${group.groupKey}/add-variant`)}
        >
          + Añadir nueva variante
        </Button>
      </div>
    </div>
  );
}
