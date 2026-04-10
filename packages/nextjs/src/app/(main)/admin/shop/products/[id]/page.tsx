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
import { AddCard } from "@/components/ui/AddCard";
import { ProductImage } from "@/components/shared/ProductImage";
import { ColorSwatchRow } from "@/components/shared/ColorSwatchRow";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { InactiveAlert } from "@/components/shared/InactiveAlert";
import { VariantGridItem } from "@/components/shared/VariantGridItem";
import { colorToHex } from "@/components/ui/ColorDot";
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
      // 1. Intentar como groupKey directo
      const groupRes = await fetch(`/api/shop/products/groups/${id}`);

      if (groupRes.ok) {
        const data = await groupRes.json();
        if (data.variants) {
          setGroup(data);
          if (!selectedVariantId || !data.variants.some((v: ProductVariant) => v.id === selectedVariantId)) {
            setSelectedVariantId(data.variants[0]?.id ?? "");
          }
          return;
        }
      }

      // 2. Puede ser un variant Prisma ID — buscar el producto para obtener su base
      const productRes = await fetch(`/api/shop/products/${id}`);
      if (productRes.ok) {
        const product = await productRes.json();
        // Si tiene base con slug, cargar el grupo por slug
        if (product.base?.slug) {
          const groupBySlug = await fetch(`/api/shop/products/groups/${product.base.slug}`);
          if (groupBySlug.ok) {
            const data = await groupBySlug.json();
            setGroup(data);
            setSelectedVariantId(id);
            return;
          }
        }
      }

      // 3. Fallback: buscar en todos los grupos
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
  }, [id, addToast, selectedVariantId]);

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
        <BackLink href="/admin/shop/products" label="Volver a productos" />
        <p className="text-text-muted">Producto no encontrado.</p>
      </div>
    );
  }

  const priceLabel = group.minPrice === group.maxPrice
    ? `${group.minPrice} ShopTokens`
    : `${group.minPrice} - ${group.maxPrice} ShopTokens`;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/shop/products" label="Volver a productos" />

      {/* Banner producto inactivo */}
      {!group.active && (
        <InactiveAlert
          resourceName={group.name}
          actionLabel="Reactivar grupo"
          onAction={handleToggleGroup}
          loading={toggling === "group"}
        />
      )}

      {/* ── Layout principal: imagen + info + variante seleccionada ── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Columna izquierda: Imagen + color swatches */}
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

        {/* Columna derecha: Info grupo + botones grupo + variante seleccionada */}
        <div className="space-y-5">
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

          {/* Precio + stock en línea */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary">{priceLabel}</span>
            <span className="text-sm text-text-muted">· {group.totalStock} uds. en stock</span>
          </div>

          {/* Botones del grupo */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push(`/admin/shop/products/${group.groupKey}/edit-group`)}
            >
              Editar grupo
            </Button>
            <Button
              variant={group.active ? "danger" : "primary"}
              className="flex-1"
              onClick={handleToggleGroup}
              loading={toggling === "group"}
            >
              {group.active ? "Desactivar grupo" : "Reactivar grupo"}
            </Button>
          </div>

          {/* Variante seleccionada — debajo de los botones del grupo */}
          <Card className={`${selectedVariant.active ? "bg-primary/5 border-primary/20" : "bg-danger/5 border-danger/20"}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-text">{selectedVariant.name}</h3>
                <Badge variant={selectedVariant.active ? "success" : "danger"}>
                  {selectedVariant.active ? "Activa" : "Inactiva"}
                </Badge>
              </div>
              <Badge variant="neutral">#{selectedVariant.productId}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 mb-4">
              <div>
                <p className="text-xs text-text-muted">Color</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-border-default"
                    style={{ backgroundColor: colorToHex(selectedVariant.color || "default") }}
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
                onClick={() => router.push(`/admin/shop/products/variants/${selectedVariant.id}/edit?from=detail&group=${group.groupKey}`)}
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
                {selectedVariant.active ? "Desactivar variante" : "Reactivar variante"}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Grid de todas las variantes + card de añadir ── */}
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
              onEdit={() => router.push(`/admin/shop/products/variants/${v.id}/edit?from=detail&group=${group.groupKey}`)}
              onToggleActive={() => handleToggleVariant(v.id, v.active)}
            />
          ))}

          {/* Card de añadir variante — solo si no crea una fila sola */}
          {/* Ocultar en cada breakpoint si variants.length es múltiplo de las columnas de ese breakpoint */}
          <AddCard
            label="Añadir variante"
            onClick={() => router.push(`/admin/shop/products/${group.groupKey}/add-variant`)}
            className={[
              group.variants.length % 2 === 0 ? "hidden" : "",
              group.variants.length % 3 === 0 ? "sm:hidden" : "sm:flex",
              group.variants.length % 4 === 0 ? "lg:hidden" : "lg:flex",
            ].join(" ")}
          />
        </div>

        {/* Botón pequeño — solo visible cuando la card está oculta */}
        <div className={[
          "flex justify-center pt-2",
          group.variants.length % 2 === 0 ? "" : "hidden",
          group.variants.length % 3 === 0 ? "sm:flex" : "sm:hidden",
          group.variants.length % 4 === 0 ? "lg:flex" : "lg:hidden",
        ].join(" ")}>
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/shop/products/${group.groupKey}/add-variant`)}
          >
            + Añadir nueva variante
          </Button>
        </div>
      </section>
    </div>
  );
}
