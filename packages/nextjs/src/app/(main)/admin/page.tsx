"use client";

/**
 * Dashboard del ADMIN.
 *
 * Visión global de la plataforma para el administrador/secretario:
 * - Usuarios: totales (clicable → lista), por rol (datos reales)
 * - Biblioteca: estado general del servicio
 * - Tienda: productos, pedidos, tokens SHOP
 * - Insignias: tipos creados, badges otorgados
 * - Impresión: impresoras activas (clicable → gestión), impresiones (clicable → historial)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthUser } from "@/hooks/useAuthUser";
import { icons } from "@/components/ui/icons";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { CompoundCard } from "@/components/shared/CompoundCard";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

/** Icono de flecha diagonal ↗ para cards clicables */
function ClickableArrow() {
  return (
    <span className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <line x1="7" y1="17" x2="17" y2="7" />
        <polyline points="7 7 17 7 17 17" />
      </svg>
    </span>
  );
}

interface UserCounts {
  total: number;
  students: number;
  professors: number;
  librarians: number;
  admins: number;
}

export default function AdminDashboard() {
  const { user, loading } = useAuthUser();

  const [userCounts, setUserCounts] = useState<UserCounts | null>(null);
  const [activePrinters, setActivePrinters] = useState<number | string>("—");
  const [totalPrintLogs, setTotalPrintLogs] = useState<number | string>("—");
  const [shopStats, setShopStats] = useState<{ products: number | string; orders: number | string; tokensInCirculation: number | string }>({
    products: "—",
    orders: "—",
    tokensInCirculation: "—",
  });
  const [libraryStats, setLibraryStats] = useState<{ activeItems: number | string; activeLoans: number | string; pendingPickups: number | string }>({
    activeItems: "—", activeLoans: "—", pendingPickups: "—",
  });
  const [roomStats, setRoomStats] = useState<{ activeRooms: number | string; todayBookings: number | string }>({
    activeRooms: "—", todayBookings: "—",
  });

  useEffect(() => {
    if (!user) return;

    // Usuarios registrados con conteo por rol
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        const users = data.users ?? [];
        setUserCounts({
          total: users.length,
          students: users.filter((u: { role: string }) => u.role === "STUDENT").length,
          professors: users.filter((u: { role: string }) => u.role === "PROFESSOR").length,
          librarians: users.filter((u: { role: string }) => u.role === "LIBRARIAN").length,
          admins: users.filter((u: { role: string }) => u.role === "ADMIN").length,
        });
      })
      .catch(() => {});

    // Impresoras activas
    fetch("/api/printer")
      .then((r) => r.json())
      .then((data) => setActivePrinters(Array.isArray(data) ? data.length : "—"))
      .catch(() => {});

    // Total impresiones del sistema
    fetch("/api/printer/logs/admin?limit=200&offset=0")
      .then((r) => r.json())
      .then((data) => setTotalPrintLogs(Array.isArray(data) ? data.length : "—"))
      .catch(() => {});

    // Estadísticas de la biblioteca
    fetch("/api/library/stats")
      .then((r) => r.json())
      .then((data) => {
        setLibraryStats({
          activeItems: data.activeItems ?? "—",
          activeLoans: data.activeLoans ?? "—",
          pendingPickups: data.pendingPickups ?? "—",
        });
      })
      .catch(() => {});

    // Estadísticas de salas
    fetch("/api/rooms/stats")
      .then((r) => r.json())
      .then((data) => {
        setRoomStats({
          activeRooms: data.activeRooms ?? "—",
          todayBookings: data.todayBookings ?? "—",
        });
      })
      .catch(() => {});

    // Estadísticas de la tienda
    fetch("/api/shop/stats")
      .then((r) => r.json())
      .then((data) => {
        setShopStats({
          products: data.activeProducts ?? "—",
          orders: data.totalOrders ?? "—",
          tokensInCirculation: data.tokensInCirculation ?? "—",
        });
      })
      .catch(() => {});
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <DashboardGreeting
        name={user.name}
        subtitle="Panel de administración de CryptoCampus."
      />

      {/* ── Sección: Usuarios ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.users}>Usuarios</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card clicable → lista de usuarios */}
          <Link href="/admin/users" className="group">
            <Card className="relative h-full hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  {icons.users}
                </div>
                <div>
                  <p className="text-sm text-text-muted">Usuarios totales</p>
                  <p className="text-2xl font-bold text-text">{userCounts?.total ?? "—"}</p>
                  <p className="text-xs text-text-muted">Registrados en la plataforma</p>
                </div>
              </div>
              <ClickableArrow />
            </Card>
          </Link>

          <CompoundCard
            icon={icons.student}
            title="Usuarios por rol"
            className="sm:col-span-2 lg:col-span-3"
            slots={[
              { value: userCounts?.students ?? "—", label: "Estudiantes", color: "text-primary" },
              { value: userCounts?.professors ?? "—", label: "Profesores", color: "text-success" },
              { value: userCounts?.librarians ?? "—", label: "Bibliotecarios", color: "text-warning" },
              { value: userCounts?.admins ?? "—", label: "Admins", color: "text-danger" },
            ]}
          />
        </div>
      </section>

      {/* ── Sección: Biblioteca ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.library}>Biblioteca</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/library/items" className="group">
            <Card className="relative h-full hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  {icons.library}
                </div>
                <div>
                  <p className="text-sm text-text-muted">Ítems en catálogo</p>
                  <p className="text-2xl font-bold text-text">{libraryStats.activeItems}</p>
                  <p className="text-xs text-text-muted">Títulos activos</p>
                </div>
              </div>
              <ClickableArrow />
            </Card>
          </Link>
          <Link href="/admin/library/loans" className="group">
            <Card className="relative h-full hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  {icons.loans}
                </div>
                <div>
                  <p className="text-sm text-text-muted">Préstamos activos</p>
                  <p className="text-2xl font-bold text-text">{libraryStats.activeLoans}</p>
                  <p className="text-xs text-text-muted">{libraryStats.pendingPickups} por recoger</p>
                </div>
              </div>
              <ClickableArrow />
            </Card>
          </Link>
          <Link href="/admin/library/rooms" className="group">
            <Card className="relative h-full hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  {icons.rooms}
                </div>
                <div>
                  <p className="text-sm text-text-muted">Salas activas</p>
                  <p className="text-2xl font-bold text-text">{roomStats.activeRooms}</p>
                  <p className="text-xs text-text-muted">{roomStats.todayBookings} reservas hoy</p>
                </div>
              </div>
              <ClickableArrow />
            </Card>
          </Link>
        </div>
      </section>

      {/* ── Sección: Tienda ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.shop}>Tienda</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/admin/shop/products" className="group">
            <Card className="relative h-full hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  {icons.shop}
                </div>
                <div>
                  <p className="text-sm text-text-muted">Productos activos</p>
                  <p className="text-2xl font-bold text-text">{shopStats.products}</p>
                  <p className="text-xs text-text-muted">En el catálogo</p>
                </div>
              </div>
              <ClickableArrow />
            </Card>
          </Link>

          <Link href="/admin/shop/orders" className="group">
            <Card className="relative h-full hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  {icons.orders}
                </div>
                <div>
                  <p className="text-sm text-text-muted">Pedidos totales</p>
                  <p className="text-2xl font-bold text-text">{shopStats.orders}</p>
                  <p className="text-xs text-text-muted">Realizados en la plataforma</p>
                </div>
              </div>
              <ClickableArrow />
            </Card>
          </Link>

          <Link href="/admin/shop/transactions" className="group">
            <Card className="relative h-full hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  {icons.token}
                </div>
                <div>
                  <p className="text-sm text-text-muted">ShopTokens en circulación</p>
                  <p className="text-2xl font-bold text-text">{shopStats.tokensInCirculation}</p>
                  <p className="text-xs text-text-muted">Ver log de transacciones</p>
                </div>
              </div>
              <ClickableArrow />
            </Card>
          </Link>
        </div>
      </section>

      {/* ── Sección: Insignias ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.badge}>Insignias</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Tipos de insignia" value="—" subtitle="Creados por profesores" icon={icons.badge} />
          <StatCard title="Insignias otorgadas" value="—" subtitle="Total en la plataforma" icon={icons.badge} />
        </div>
      </section>

      {/* ── Sección: Impresión ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.print}>Impresión</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Impresoras → gestión de impresoras */}
          <Link href="/admin/printing/printers" className="group">
            <Card className="relative h-full hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  {icons.print}
                </div>
                <div>
                  <p className="text-sm text-text-muted">Impresoras activas</p>
                  <p className="text-2xl font-bold text-text">{activePrinters}</p>
                  <p className="text-xs text-text-muted">Disponibles para imprimir</p>
                </div>
              </div>
              <ClickableArrow />
            </Card>
          </Link>

          {/* Impresiones → historial */}
          <Link href="/admin/printing/logs" className="group">
            <Card className="relative h-full hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  {icons.orders}
                </div>
                <div>
                  <p className="text-sm text-text-muted">Impresiones realizadas</p>
                  <p className="text-2xl font-bold text-text">{totalPrintLogs}</p>
                  <p className="text-xs text-text-muted">Total en la plataforma</p>
                </div>
              </div>
              <ClickableArrow />
            </Card>
          </Link>
        </div>
      </section>
    </div>
  );
}
