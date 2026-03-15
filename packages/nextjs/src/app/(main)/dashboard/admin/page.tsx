"use client";

/**
 * Dashboard del ADMIN.
 *
 * Visión global de la plataforma para el administrador/secretario:
 * - Usuarios: totales, por rol, registros recientes
 * - Biblioteca: estado general del servicio (libros, préstamos activos, vencidos)
 * - Tienda: productos, pedidos, tokens SHOP en circulación
 * - Insignias: tipos creados, badges otorgados globalmente
 * - Impresión: créditos totales asignados, páginas impresas
 */

import { useEffect, useState } from "react";
import { StatCard } from "@/components/shared/StatCard";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

interface UserData {
  name: string;
}

/* ── Iconos ── */
const icons = {
  users: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  student: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  ),
  library: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  loans: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  shop: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  orders: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  badge: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  ),
  print: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  ),
  token: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
};

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <h2 className="text-lg font-semibold text-text">{children}</h2>
    </div>
  );
}

export default function AdminDashboard() {
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── Saludo ── */}
      <div>
        <h1 className="text-2xl font-bold text-text">
          Bienvenido, {user.name.split(" ")[0]}
        </h1>
        <p className="text-text-muted mt-1">
          Panel de administración de CryptoCampus.
        </p>
      </div>

      {/* ── Sección: Usuarios ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.users}>Usuarios</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Usuarios totales"
            value="—"
            subtitle="Registrados en la plataforma"
            icon={icons.users}
          />

          {/* Card compuesta: desglose por rol */}
          <Card className="flex items-start gap-4 sm:col-span-2 lg:col-span-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icons.student}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-muted">Usuarios por rol</p>
              <div className="mt-2 flex items-center divide-x divide-border-default">
                <div className="pr-4">
                  <p className="text-xl font-bold text-primary">—</p>
                  <p className="text-xs text-text-muted">Estudiantes</p>
                </div>
                <div className="px-4">
                  <p className="text-xl font-bold text-success">—</p>
                  <p className="text-xs text-text-muted">Profesores</p>
                </div>
                <div className="px-4">
                  <p className="text-xl font-bold text-warning">—</p>
                  <p className="text-xs text-text-muted">Bibliotecarios</p>
                </div>
                <div className="pl-4">
                  <p className="text-xl font-bold text-danger">—</p>
                  <p className="text-xs text-text-muted">Admins</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ── Sección: Biblioteca ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.library}>Biblioteca</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Libros en catálogo"
            value="—"
            subtitle="Títulos registrados"
            icon={icons.library}
          />
          <StatCard
            title="Préstamos activos"
            value="—"
            subtitle="En curso"
            icon={icons.loans}
          />
          <StatCard
            title="Tokens LIB en circulación"
            value="—"
            subtitle="Total emitidos"
            icon={icons.token}
          />
        </div>
      </section>

      {/* ── Sección: Tienda ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.shop}>Tienda</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Productos activos"
            value="—"
            subtitle="En el catálogo"
            icon={icons.shop}
          />
          <StatCard
            title="Pedidos totales"
            value="—"
            subtitle="Realizados en la plataforma"
            icon={icons.orders}
          />
          <StatCard
            title="Tokens SHOP en circulación"
            value="—"
            subtitle="Total emitidos"
            icon={icons.token}
          />
        </div>
      </section>

      {/* ── Sección: Insignias ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.badge}>Insignias</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Tipos de insignia"
            value="—"
            subtitle="Creados por profesores"
            icon={icons.badge}
          />
          <StatCard
            title="Insignias otorgadas"
            value="—"
            subtitle="Total en la plataforma"
            icon={icons.badge}
          />
        </div>
      </section>

      {/* ── Sección: Impresión ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.print}>Impresión</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Créditos asignados"
            value="—"
            subtitle="Total repartidos"
            icon={icons.print}
          />
          <StatCard
            title="Páginas impresas"
            value="—"
            subtitle="Total consumidas"
            icon={icons.print}
          />
        </div>
      </section>
    </div>
  );
}
