"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { NavGroup } from "@/components/shared/NavGroup";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import { NavBrand } from "@/components/ui/NavBrand";
import { NavItem } from "@/components/ui/NavItem";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { icons } from "@/components/ui/icons";
import type { UserRole } from "@/types";

interface AuthUser {
  name: string;
  role: UserRole;
}

interface ShopPreviewProduct {
  id: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  price: number;
  stock: number;
  color: string | null;
  variantLabel: string | null;
}

interface PublicPreviewPayload {
  printingTokensPreview: number;
  availableRooms: number;
  availableBooks: number;
  shop: {
    categories: string[];
    products: ShopPreviewProduct[];
  };
}

const EMPTY_PREVIEW: PublicPreviewPayload = {
  printingTokensPreview: 200,
  availableRooms: 0,
  availableBooks: 0,
  shop: {
    categories: [],
    products: [],
  },
};

function buildLoginHref(returnUrl: string, pendingProductId?: string) {
  const query = new URLSearchParams({ returnUrl });
  if (pendingProductId) {
    query.set("pendingProductId", pendingProductId);
    query.set("pendingQty", "1");
  }
  return `/login?${query.toString()}`;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [preview, setPreview] = useState<PublicPreviewPayload>(EMPTY_PREVIEW);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  useEffect(() => {
    fetch("/api/public/preview")
      .then((res) => (res.ok ? res.json() : EMPTY_PREVIEW))
      .then((data) => setPreview(data as PublicPreviewPayload))
      .catch(() => setPreview(EMPTY_PREVIEW));
  }, []);

  const role = user?.role ?? null;
  const panelHref = role ? `/${role.toLowerCase()}` : null;

  useEffect(() => {
    if (checked && panelHref) {
      router.replace(panelHref);
    }
  }, [checked, panelHref, router]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Spinner size="lg" />
      </div>
    );
  }

  if (panelHref) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 lg:static lg:z-auto transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <aside className="flex h-full w-64 flex-col border-r border-border-default bg-card">
          <div className="flex h-16 items-center border-b border-border-default px-3">
            <NavBrand />
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
            <NavGroup title="Principal">
              <NavItem href="/login?returnUrl=/" icon={icons.home} label="Panel" />
            </NavGroup>

            <NavGroup title="Servicios">
              <NavItem href="/login?returnUrl=/printing" icon={icons.print} label="Impresión" />
              <NavItem href="/login?returnUrl=/rooms" icon={icons.rooms} label="Salas" />
              <NavItem href="/login?returnUrl=/loans" icon={icons.library} label="Préstamos" />
              <NavItem href="/login?returnUrl=/badges" icon={icons.badge} label="Insignias" />
              <NavItem href="/login?returnUrl=/shop" icon={icons.shop} label="Tienda" />
            </NavGroup>
          </nav>

          <div className="space-y-1 border-t border-border-default p-3">
            <ThemeSwitcher />
            <Link
              href="/login"
              className="flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-on-primary transition-colors hover:bg-primary-hover"
            >
              Iniciar sesión
            </Link>
          </div>
        </aside>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

        <main className="flex-1 overflow-y-auto p-6">
          <section className="mx-auto max-w-5xl py-6 text-center">
            <h1 className="text-4xl font-bold text-text">
              Plataforma universitaria en blockchain
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-text-muted">
              Biblioteca, tienda, insignias, impresión y salas de estudio, todo gestionado con contratos inteligentes en la UCM.
            </p>
          </section>

          <section className="mx-auto max-w-5xl pb-10">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="space-y-3 p-5">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">{icons.print}</div>
                <h3 className="font-semibold text-text">Impresión</h3>
                <p className="text-sm text-text-muted">
                  {preview.printingTokensPreview} Tokens para imprimir disponibles.
                </p>
                <Link href={buildLoginHref("/printing")} className="text-sm font-medium text-primary hover:underline">
                  Ir a impresiones
                </Link>
              </Card>

              <Card className="space-y-3 p-5">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">{icons.rooms}</div>
                <h3 className="font-semibold text-text">Salas de estudio</h3>
                <p className="text-sm text-text-muted">{preview.availableRooms} salas disponibles ahora.</p>
                <Link href={buildLoginHref("/rooms")} className="text-sm font-medium text-primary hover:underline">
                  Reservar sala
                </Link>
              </Card>

              <Card className="space-y-3 p-5">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">{icons.library}</div>
                <h3 className="font-semibold text-text">Préstamos</h3>
                <p className="text-sm text-text-muted">{preview.availableBooks} libros disponibles para préstamo.</p>
                <Link href={buildLoginHref("/loans")} className="text-sm font-medium text-primary hover:underline">
                  Ir a préstamos
                </Link>
              </Card>

              <Card className="space-y-3 p-5">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">{icons.badge}</div>
                <h3 className="font-semibold text-text">Insignias</h3>
                <p className="text-sm text-text-muted">Consigue insignias mientras aprendes.</p>
                <Link href={buildLoginHref("/badges")} className="text-sm font-medium text-primary hover:underline">
                  Ver insignias
                </Link>
              </Card>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-text">Tienda</h2>
                <Link href={buildLoginHref("/shop")} className="text-sm font-medium text-primary hover:underline">
                  Ver catálogo completo
                </Link>
              </div>

              <div className="flex flex-wrap gap-2">
                {preview.shop.categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full border border-border-default bg-card px-3 py-1 text-xs font-medium text-text-muted"
                  >
                    {category}
                  </span>
                ))}
                {preview.shop.categories.length === 0 && (
                  <span className="text-xs text-text-muted">Sin filtros disponibles</span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {preview.shop.products.map((product) => (
                  <Card key={product.id} className="space-y-3 p-5">
                    <div className="line-clamp-2 min-h-[48px] text-base font-semibold text-text">{product.name}</div>
                    <p className="text-sm text-text-muted line-clamp-2">
                      {product.variantLabel ?? product.color ?? product.category ?? "Producto del catálogo"}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-primary">{product.price} ShopTokens</span>
                      <span className="text-text-muted">Stock: {product.stock}</span>
                    </div>
                    <Link
                      href={buildLoginHref("/shop/cart", product.id)}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-text-on-primary transition-colors hover:bg-primary-hover"
                    >
                      Añadir al carrito
                    </Link>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
