"use client";

/**
 * Catálogo de la tienda del estudiante.
 *
 * Layout:
 * - Fila superior: Balance | Pedidos | Carrito (abre drawer) | Recargar
 * - Filtro por categoría: pills horizontales
 * - Grid de productos: cards clickables
 * - CartDrawer: panel lateral del carrito (slide-in derecha)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/useToast";
import { useCart } from "@/contexts/CartContext";
import { icons } from "@/components/ui/icons";
import { CreditsBanner } from "@/components/shared/CreditsBanner";
import { ProductCard } from "@/components/shared/ProductCard";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { LinkArrow } from "@/components/shared/LinkArrow";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";

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
  defaultVariantId: string;
  variants: ProductVariant[];
}

export default function StudentShopPage() {
  const { addToast } = useToast();
  const { openCart, itemCount, setItemCount } = useCart();

  const [balance, setBalance] = useState<number | null>(null);
  const [totalBatches, setTotalBatches] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductGroup[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Carga inicial
  useEffect(() => {
    Promise.all([
      fetch("/api/shop/balance").then((r) => r.json()),
      fetch("/api/shop/categories").then((r) => r.json()),
      fetch("/api/shop/products").then((r) => r.json()),
      fetch("/api/shop/batches?limit=1&offset=0").then((r) => r.json()),
      fetch("/api/shop/orders?limit=1&offset=0").then((r) => r.json()),
      fetch("/api/shop/cart").then((r) => r.json()),
    ])
      .then(([balanceData, categoriesData, productsData, batchesData, ordersData, cartData]) => {
        setBalance(balanceData.balance ?? 0);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setProducts(Array.isArray(productsData) ? productsData : []);
        setTotalBatches(batchesData.total ?? 0);
        setTotalItems(ordersData.total ?? 0);
        setItemCount(Array.isArray(cartData.items) ? cartData.items.length : 0);
      })
      .catch(() => addToast("Error al cargar la tienda", "danger"))
      .finally(() => setLoading(false));
  }, []);

  // Filtrar productos por categoría (local, sin fetch)
  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category === selectedCategory)
    : products;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── 1. Fila superior ── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {/* Balance */}
        <CreditsBanner
          icon={icons.shop}
          value={balance ?? "—"}
          label="ShopTokens disponibles"
          hint="Se usan para comprar en la tienda"
        />

        {/* Pedidos */}
        <Link href="/dashboard/student/shop/orders" className="group">
          <Card className="flex items-center gap-4 h-full relative hover:border-primary/50 transition-colors">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              {icons.orders}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-muted">Mis pedidos</p>
              <p className="text-xl font-bold text-text">{totalBatches} ticket{totalBatches !== 1 ? "s" : ""} · {totalItems} artículo{totalItems !== 1 ? "s" : ""}</p>
              <p className="text-xs text-text-muted mt-0.5">Ver historial de compras</p>
            </div>
            <LinkArrow />
          </Card>
        </Link>

        {/* Carrito — abre drawer en vez de navegar */}
        <button type="button" onClick={openCart} className="group text-left cursor-pointer">
          <Card className="flex items-center gap-4 h-full relative hover:border-primary/50 transition-colors">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              {/* Icono carrito */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-muted">Carrito</p>
              <p className="text-3xl font-bold text-text">{itemCount}</p>
              <p className="text-xs text-text-muted mt-0.5">Ver y editar carrito</p>
            </div>
            <LinkArrow />
          </Card>
        </button>

        {/* Recargar */}
        <Link href="/dashboard/student/shop/topup" className="group">
          <Card className="flex items-center gap-4 h-full relative hover:border-primary/50 transition-colors">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              {icons.token}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-muted">Recargar saldo</p>
              <p className="text-lg font-bold text-text">Tarjeta simulada</p>
              <p className="text-xs text-text-muted mt-0.5">Anadir ShopTokens</p>
            </div>
            <LinkArrow />
          </Card>
        </Link>
      </section>

      {/* ── 2. Catálogo ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.shop}>Catálogo</SectionTitle>

        {categories.length > 0 && (
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        )}

        {filteredProducts.length === 0 ? (
          <EmptyState
            title="Sin productos"
            description={
              selectedCategory
                ? `No hay productos en la categoría "${selectedCategory}".`
                : "Aún no hay productos disponibles en la tienda."
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
                onAddToCart={() => openCart()}
              />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
