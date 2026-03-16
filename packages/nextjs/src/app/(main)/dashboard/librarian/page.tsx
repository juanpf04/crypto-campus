"use client";

/**
 * Dashboard del BIBLIOTECARIO.
 *
 * Secciones basadas en sus funcionalidades del contrato LibraryManager:
 * - Catálogo: libros totales, copias disponibles
 * - Préstamos: solicitudes pendientes, préstamos activos, vencidos
 */

import { useAuthUser } from "@/hooks/useAuthUser";
import { icons } from "@/lib/icons";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { CompoundCard } from "@/components/shared/CompoundCard";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { Spinner } from "@/components/ui/Spinner";

export default function LibrarianDashboard() {
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
        subtitle="Panel de gestión de la biblioteca."
      />

      {/* ── Sección: Catálogo ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Catálogo</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Libros en catálogo"
            value="—"
            subtitle="Títulos registrados"
            icon={icons.library}
          />
          <StatCard
            title="Copias disponibles"
            value="—"
            subtitle="No prestadas actualmente"
            icon={icons.items}
          />
        </div>
      </section>

      {/* ── Sección: Préstamos ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.loans}>Préstamos</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CompoundCard
            icon={icons.loans}
            title="Estado de préstamos"
            slots={[
              { value: "—", label: "Solicitudes", color: "text-warning" },
              { value: "—", label: "Activos", color: "text-primary" },
              { value: "—", label: "Vencidos", color: "text-danger" },
            ]}
          />

          <StatCard
            title="Devoluciones hoy"
            value="—"
            subtitle="Previstas para hoy"
            icon={icons.pending}
          />
          <StatCard
            title="Préstamos vencidos"
            value="—"
            subtitle="Requieren atención"
            icon={icons.alert}
          />
        </div>
      </section>
    </div>
  );
}
