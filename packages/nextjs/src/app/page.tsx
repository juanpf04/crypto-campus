"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { icons } from "@/components/ui/icons";
import type { UserRole } from "@/types";

interface AuthUser {
  name: string;
  role: UserRole;
}

const MODULES = [
  {
    key: "library",
    icon: icons.library,
    title: "Biblioteca",
    description: "Reserva libros, juegos de mesa, videojuegos, imprime documentos y reserva salas de estudio.",
    roles: ["STUDENT", "LIBRARIAN", "ADMIN"],
    studentHref: "/student/library",
  },
  {
    key: "shop",
    icon: icons.shop,
    title: "Tienda",
    description: "Compra merchandising oficial de la UCM con ShopTokens.",
    roles: ["STUDENT", "ADMIN"],
    studentHref: "/student/shop",
  },
  {
    key: "badges",
    icon: icons.badge,
    title: "Insignias",
    description: "Gana insignias completando tareas y canjea recompensas.",
    roles: ["STUDENT", "PROFESSOR", "ADMIN"],
    studentHref: "/student/badges",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => {})
      .finally(() => setChecked(true));
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
          <div className="flex h-16 items-center border-b border-border-default px-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-sm font-bold text-text-on-primary">
                CC
              </div>
              <span className="text-base font-semibold text-text">CryptoCampus</span>
            </div>
          </div>

          <nav className="flex-1 space-y-2 p-4">
            <Link
              href="/login"
              className="flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-on-primary transition-colors hover:bg-primary-hover"
            >
              Iniciar sesión
            </Link>
          </nav>
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
              Biblioteca, tienda, insignias, impresion y salas de estudio, todo gestionado con contratos inteligentes en la UCM.
            </p>

            {user && panelHref && (
              <div className="mt-6">
                <Link
                  href={panelHref}
                  className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-on-primary transition-colors hover:bg-primary-hover"
                >
                  Ir a mi panel
                </Link>
              </div>
            )}
          </section>

          <section className="mx-auto max-w-5xl pb-10">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((mod) => {
                const hasAccess = role ? mod.roles.includes(role) : false;
                const href = !user
                  ? `/login?returnUrl=${mod.studentHref}`
                  : hasAccess
                    ? mod.studentHref
                    : null;

                const content = (
                  <Card
                    className={`h-full space-y-3 p-5 transition-colors ${
                      !user || hasAccess
                        ? "cursor-pointer hover:border-primary/50"
                        : "cursor-not-allowed opacity-40"
                    }`}
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                      {mod.icon}
                    </div>
                    <h3 className="font-semibold text-text">{mod.title}</h3>
                    <p className="text-sm text-text-muted">{mod.description}</p>
                    {user && !hasAccess && (
                      <p className="text-xs italic text-text-muted">No disponible para tu rol</p>
                    )}
                  </Card>
                );

                if (href) {
                  return (
                    <Link key={mod.key} href={href} className="block">
                      {content}
                    </Link>
                  );
                }

                return <div key={mod.key}>{content}</div>;
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
