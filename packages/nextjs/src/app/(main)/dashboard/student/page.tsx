"use client";

/**
 * Dashboard del ESTUDIANTE.
 *
 * Secciones (en el orden del sidebar):
 * - Impresión: créditos de impresión disponibles
 * - Biblioteca: tokens LIB + préstamos activos
 * - Insignias y Recompensas: insignias obtenidas, recompensas (usadas/pendientes/disponibles), tareas
 * - Tienda: tokens SHOP
 */

import { useAuthUser } from "@/hooks/useAuthUser";
import { icons } from "@/lib/icons";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { CompoundCard } from "@/components/shared/CompoundCard";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { Spinner } from "@/components/ui/Spinner";

export default function StudentDashboard() {
  const { user, loading } = useAuthUser();

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
        subtitle="Aquí tienes un resumen de tu actividad en CryptoCampus."
      />

      {/* ── Sección: Impresión ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.print}>Impresión</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Impresiones disponibles"
            value="—"
            subtitle="Restantes este periodo"
            icon={icons.print}
          />
        </div>
      </section>

      {/* ── Sección: Biblioteca ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.library}>Biblioteca</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Tokens LIB"
            value="—"
            subtitle="Balance actual"
            icon={icons.library}
          />
          <StatCard
            title="Préstamos activos"
            value="—"
            subtitle="En curso"
            icon={icons.loans}
          />
        </div>
      </section>

      {/* ── Sección: Insignias y Recompensas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.badge}>Insignias y Recompensas</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Insignias obtenidas"
            value="—"
            subtitle="Total"
            icon={icons.badge}
          />

          <CompoundCard
            icon={icons.reward}
            title="Recompensas"
            slots={[
              { value: "—", label: "Usadas", color: "text-success" },
              { value: "—", label: "Pendientes", color: "text-warning" },
              { value: "—", label: "Disponibles", color: "text-primary" },
            ]}
          />

          <StatCard
            title="Tareas disponibles"
            value="—"
            subtitle="Para conseguir insignias"
            icon={icons.task}
          />
        </div>
      </section>

      {/* ── Sección: Tienda ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.shop}>Tienda</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Tokens SHOP"
            value="—"
            subtitle="Balance actual"
            icon={icons.shop}
          />
        </div>
      </section>
    </div>
  );
}
