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
import { useAuthUser } from "@/hooks/useAuthUser";
import { icons } from "@/lib/icons";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { CompoundCard } from "@/components/shared/CompoundCard";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { Spinner } from "@/components/ui/Spinner";

export default function AdminDashboard() {
  const { user, loading } = useAuthUser();

  // Datos reales de impresión
  const [activePrinters, setActivePrinters] = useState<number | string>("—");
  const [totalPrintLogs, setTotalPrintLogs] = useState<number | string>("—");

  useEffect(() => {
    if (!user) return;

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
          <StatCard
            title="Usuarios totales"
            value="—"
            subtitle="Registrados en la plataforma"
            icon={icons.users}
          />

          <CompoundCard
            icon={icons.student}
            title="Usuarios por rol"
            className="sm:col-span-2 lg:col-span-3"
            slots={[
              { value: "—", label: "Estudiantes", color: "text-primary" },
              { value: "—", label: "Profesores", color: "text-success" },
              { value: "—", label: "Bibliotecarios", color: "text-warning" },
              { value: "—", label: "Admins", color: "text-danger" },
            ]}
          />
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
            title="Impresoras activas"
            value={activePrinters}
            subtitle="Disponibles para imprimir"
            icon={icons.print}
          />
          <StatCard
            title="Impresiones realizadas"
            value={totalPrintLogs}
            subtitle="Total en la plataforma"
            icon={icons.orders}
          />
        </div>
      </section>
    </div>
  );
}
