"use client";

/**
 * Catálogo de la tienda del estudiante.
 *
 * Layout:
 * - Fila superior (50/50): Banner de ShopTokens | Card clicable de pedidos
 * - Filtro por categoría: pills horizontales
 * - Grid de productos: cards clickables
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/useToast";
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

  const [balance, setBalance] = useState<number | null>(null);
  const [totalOrders, setTotalOrders] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductGroup[]>([]);
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Carga inicial: balance + categorías + productos + total pedidos
  useEffect(() => {
    Promise.all([
      fetch("/api/shop/balance").then((r) => r.json()),
      fetch("/api/shop/categories").then((r) => r.json()),
      fetch("/api/shop/products").then((r) => r.json()),
      fetch("/api/shop/orders?limit=1&offset=0").then((r) => r.json()),
      fetch("/api/shop/cart").then((r) => r.json()),
    ])
      .then(([balanceData, categoriesData, productsData, ordersData, cartData]) => {
        setBalance(balanceData.balance ?? 0);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setProducts(Array.isArray(productsData) ? productsData : []);
        setTotalOrders(ordersData.total ?? 0);
        setCartItemsCount(Array.isArray(cartData.items) ? cartData.items.length : 0);
      })
      .catch(() => addToast("Error al cargar la tienda", "danger"))
      .finally(() => setLoading(false));
  }, []);

  // Filtrar productos cuando cambia la categoría (sin fetch, filtro local)
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
      {/* ── 1. Fila superior: Balance (50%) + Pedidos (50%) ── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {/* Balance de ShopTokens */}
        <CreditsBanner
          icon={icons.shop}
          value={balance ?? "—"}
          label="ShopTokens disponibles"
          hint="Se usan para comprar en la tienda"
        />

        {/* Card clicable de pedidos */}
        <Link href="/dashboard/student/shop/orders" className="group">
          <Card className="flex items-center gap-4 h-full relative hover:border-primary/50 transition-colors">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              {icons.orders}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-muted">Mis pedidos</p>
              <p className="text-3xl font-bold text-text">{totalOrders}</p>
              <p className="text-xs text-text-muted mt-0.5">Ver historial de compras</p>
            </div>
            <LinkArrow />
          </Card>
        </Link>

        {/* Card clicable de carrito */}
        <Link href="/dashboard/student/shop/cart" className="group">
          <Card className="flex items-center gap-4 h-full relative hover:border-primary/50 transition-colors">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              {icons.shop}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-muted">Carrito</p>
              <p className="text-3xl font-bold text-text">{cartItemsCount}</p>
              <p className="text-xs text-text-muted mt-0.5">Ver y editar carrito</p>
            </div>
            <LinkArrow />
          </Card>
        </Link>

        {/* Card clicable de recarga simulada */}
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

        {/* Filtro por categoría */}
        {categories.length > 0 && (
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        )}

        {/* Grid de productos */}
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
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
