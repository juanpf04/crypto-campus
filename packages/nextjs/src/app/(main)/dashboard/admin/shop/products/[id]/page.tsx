"use client";

/**
 * Detalle de producto para el admin.
 *
 * Carga el grupo completo de variantes (igual que la vista del estudiante)
 * pero desde la API admin (incluye inactivos). Muestra:
 * - Imagen grande con selector de variantes
 * - Ficha técnica completa del grupo
 * - Tabla de todas las variantes con stock individual
 * - Botones: editar grupo, eliminar/reactivar
 * - Banner de alerta si está desactivado
 *
 * Al editar se modifica toda la agrupación (precio, nombre, categoría, stock
 * se aplican a todas las variantes del grupo).
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
import { icons } from "@/components/ui/icons";

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
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  active: boolean;
  variants: ProductVariant[];
}

export default function AdminProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [group, setGroup] = useState<ProductGroup | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Cargar el grupo que contiene esta variante
  useEffect(() => {
    if (!id) return;

    fetch("/api/shop/products/admin")
      .then((r) => r.json())
      .then((groups: ProductGroup[]) => {
        if (!Array.isArray(groups)) return;

        const matched = groups.find((g) =>
          g.variants.some((v) => v.id === id),
        );

        if (matched) {
          setGroup(matched);
          setSelectedVariantId(id);
        }
      })
      .catch(() => addToast("Error al cargar producto", "danger"))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  const selectedVariant = useMemo(() => {
    if (!group) return null;
    return group.variants.find((v) => v.id === selectedVariantId) ?? group.variants[0];
  }, [group, selectedVariantId]);

  // Toggle activo/inactivo para todo el grupo
  const handleToggleActive = useCallback(async () => {
    if (!group) return;
    const wasActive = group.active;

    // Optimistic update
    setGroup((prev) => prev ? { ...prev, active: !wasActive } : prev);

    // Desactivar/reactivar todas las variantes del grupo
    try {
      const method = wasActive ? "DELETE" : "PATCH";
      const results = await Promise.all(
        group.variants.map((v) =>
          fetch(`/api/shop/products/${v.id}`, { method }),
        ),
      );

      const anyFailed = results.some((r) => !r.ok);
      if (anyFailed) throw new Error("Algunas variantes no se pudieron actualizar");

      addToast(
        wasActive
          ? `${group.name} desactivado (${group.variants.length} variantes)`
          : `${group.name} reactivado (${group.variants.length} variantes)`,
        "success",
      );
    } catch (err) {
      // Revertir
      setGroup((prev) => prev ? { ...prev, active: wasActive } : prev);
      addToast(err instanceof Error ? err.message : "Error", "danger");
    }
  }, [group, addToast]);

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
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-warning shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-sm text-text">
            Este producto está <strong>desactivado</strong> y no es visible para los estudiantes.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleToggleActive}
            className="ml-auto shrink-0"
          >
            Reactivar
          </Button>
        </div>
      )}

      {/* ── Layout principal: imagen + info ── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Imagen + variantes */}
        <Card className="flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-sm">
            <ProductImage
              imageUrl={selectedVariant.imageUrl}
              name={selectedVariant.name}
              category={selectedVariant.category}
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
              <Badge variant="info">{group.variants.length} variante{group.variants.length !== 1 ? "s" : ""}</Badge>
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

          {/* Variante seleccionada */}
          <Card className="bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-text">Variante seleccionada</p>
              <Badge variant="neutral">{selectedVariant.color || "—"}</Badge>
            </div>
            <p className="text-lg font-bold text-text mb-3">{selectedVariant.name}</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-text-muted">ID on-chain</p>
                <p className="text-sm font-semibold text-text">#{selectedVariant.productId}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Precio</p>
                <p className="text-sm font-semibold text-primary">{selectedVariant.price} ShopTokens</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Stock</p>
                <p className="text-sm font-semibold text-text">{selectedVariant.stock} uds.</p>
              </div>
            </div>
          </Card>

          {/* Botones de acción */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push(`/dashboard/admin/shop/products/${id}/edit?from=detail`)}
            >
              Editar producto
            </Button>
            <Button
              variant={group.active ? "danger" : "primary"}
              className="flex-1"
              onClick={handleToggleActive}
            >
              {group.active ? "Desactivar" : "Reactivar"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tabla de todas las variantes ── */}
      {group.variants.length > 1 && (
        <section className="space-y-4">
          <SectionTitle icon={icons.items}>Todas las variantes</SectionTitle>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-primary/5">
                    <th className="px-4 py-3 text-left font-medium text-text-muted">ID</th>
                    <th className="px-4 py-3 text-left font-medium text-text-muted">Nombre</th>
                    <th className="px-4 py-3 text-left font-medium text-text-muted">Color</th>
                    <th className="px-4 py-3 text-right font-medium text-text-muted">Precio</th>
                    <th className="px-4 py-3 text-right font-medium text-text-muted">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {group.variants.map((v) => (
                    <tr
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`border-b border-border-default last:border-b-0 cursor-pointer transition-colors ${
                        v.id === selectedVariantId
                          ? "bg-primary/10"
                          : "hover:bg-primary/5"
                      }`}
                    >
                      <td className="px-4 py-3 text-text-muted">#{v.productId}</td>
                      <td className="px-4 py-3 font-medium text-text">{v.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-4 w-4 rounded-full border border-border-default"
                            style={{ backgroundColor: v.color || "#ccc" }}
                          />
                          <span className="text-text-muted">{v.color || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">{v.price}</td>
                      <td className="px-4 py-3 text-right text-text">{v.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
