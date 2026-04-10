"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { icons } from "@/components/ui/icons";

interface AuthUser {
  name: string;
  role: string;
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  const role = user?.role || null;
  const panelHref = role ? `/${role.toLowerCase()}` : null;

  if (!checked) return null;

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border-default bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-text-on-primary font-bold text-sm">
              CC
            </div>
            <span className="text-lg font-bold text-text">CryptoCampus</span>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-text-muted">{user.name}</span>
                <Link
                  href={panelHref!}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-on-primary hover:bg-primary-hover transition-colors"
                >
                  Ir a mi panel
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-on-primary hover:bg-primary-hover transition-colors"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text hover:bg-primary/5 transition-colors"
                >
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-12 text-center">
        <h1 className="text-4xl font-bold text-text">
          Plataforma universitaria en blockchain
        </h1>
        <p className="mt-3 text-lg text-text-muted max-w-2xl mx-auto">
          Biblioteca, tienda, insignias, impresión y salas de estudio — todo gestionado con contratos inteligentes en la UCM.
        </p>
      </section>

      {/* Módulos */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
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
                className={`p-5 space-y-3 h-full transition-colors ${
                  !user || hasAccess
                    ? "hover:border-primary/50 cursor-pointer"
                    : "opacity-40 cursor-not-allowed"
                }`}
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  {mod.icon}
                </div>
                <h3 className="font-semibold text-text">{mod.title}</h3>
                <p className="text-sm text-text-muted">{mod.description}</p>
                {user && !hasAccess && (
                  <p className="text-xs text-text-muted italic">No disponible para tu rol</p>
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
    </div>
  );
}
