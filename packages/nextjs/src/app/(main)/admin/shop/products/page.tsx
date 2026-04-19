"use client";

/**
 * Gestión de productos de la tienda (admin).
 *
 * Grid de ProductCards con:
 * - Filtro por categoría (pills)
 * - Filtro por estado (Todos / Activos / Inactivos)
 * - Botones editar / eliminar-reactivar por card (optimistic update)
 * - Botón añadir producto
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { ProductCard } from "@/components/shared/ProductCard";

interface ProductVariant {
  id: string;
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
  defaultVariantId: string;
  variants: ProductVariant[];
}

type StatusFilter = "all" | "active" | "inactive";

export default function AdminProductsPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [products, setProducts] = useState<ProductGroup[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Cargar productos (admin ve todos, activos + inactivos)
  const loadProducts = useCallback(async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        fetch("/api/shop/products/admin"),
        fetch("/api/shop/categories"),
      ]);

      const productsData = await productsRes.json();
      const categoriesData = await categoriesRes.json();

      setProducts(Array.isArray(productsData) ? productsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch {
      addToast("Error al cargar productos", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Toggle activo/inactivo — optimistic update
  async function handleToggleActive(variantId: string, currentlyActive: boolean) {
    // Buscar el grupo que contiene esta variante
    const targetGroup = products.find((p) => p.variants.some((v) => v.id === variantId));
    if (!targetGroup) return;

    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => p.groupKey === targetGroup.groupKey ? { ...p, active: !currentlyActive } : p),
    );

    try {
      const res = await fetch(`/api/shop/products/groups/${targetGroup.groupKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentlyActive }),
      });
      if (!res.ok) throw new Error("Error al cambiar estado del grupo");

      addToast(
        currentlyActive ? "Grupo desactivado" : "Grupo reactivado",
        "success",
      );
    } catch (err) {
      // Revertir
      setProducts((prev) =>
        prev.map((p) => p.groupKey === targetGroup.groupKey ? { ...p, active: currentlyActive } : p),
      );
      addToast(err instanceof Error ? err.message : "Error", "danger");
    }
  }

  function handleEdit(variantId: string) {
    router.push(`/admin/shop/products/${variantId}/edit?from=list`);
  }

  // Filtrar productos
  const filteredProducts = products
    .filter((p) => {
      if (statusFilter === "active") return p.active;
      if (statusFilter === "inactive") return !p.active;
      return true;
    })
    .filter((p) => {
      if (selectedCategory) return p.category === selectedCategory;
      return true;
    });

  return (
    <div className="space-y-6">
      <BackLink href="/admin/shop" label="Volver a tienda" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Productos</h1>
          {loading ? (
            <Skeleton className="mt-2 h-4 w-52" />
          ) : (
            <p className="text-text-muted mt-1">
              {products.length} producto(s) registrados
            </p>
          )}
        </div>
        <Button disabled={loading} onClick={() => router.push("/admin/shop/products/new")}>
          Añadir producto
        </Button>
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        {/* Filtro por estado */}
        <div className="flex gap-2">
          {(["all", "active", "inactive"] as StatusFilter[]).map((status) => {
            const labels: Record<StatusFilter, string> = {
              all: "Todos",
              active: "Activos",
              inactive: "Inactivos",
            };
            return (
              <button
                key={status}
                type="button"
                disabled={loading}
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  statusFilter === status
                    ? "bg-primary text-white"
                    : "bg-card border border-border-default text-text-muted hover:text-text"
                }`}
              >
                {labels[status]}
              </button>
            );
          })}
        </div>

        {/* Filtro por categoría */}
        {!loading && categories.length > 0 && (
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        )}
      </div>

      {/* Grid de productos */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-live="polite">
          {Array.from({ length: 8 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="Sin productos"
          description={
            statusFilter !== "all" || selectedCategory
              ? "No hay productos con estos filtros."
              : "Aún no hay productos en la tienda."
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.groupKey}
              groupKey={product.groupKey}
              name={product.name}
              minPrice={product.minPrice}
              maxPrice={product.maxPrice}
              totalStock={product.totalStock}
              category={product.category}
              variants={product.variants}
              linkBase="/admin/shop/products/"
              adminMode
              active={product.active}
              onEdit={handleEdit}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
