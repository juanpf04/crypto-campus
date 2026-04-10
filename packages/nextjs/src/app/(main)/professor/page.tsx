"use client";

/**
 * Dashboard del PROFESOR.
 *
 * Secciones basadas en sus funcionalidades del contrato BadgeSystem:
 * - Insignias: tipos creados, badges otorgados
 * - Tareas: tareas activas, tareas completadas por alumnos
 * - Recompensas: recompensas creadas, solicitudes pendientes de aprobación
 */

import { useAuthUser } from "@/hooks/useAuthUser";
import { icons } from "@/components/ui/icons";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { CompoundCard } from "@/components/shared/CompoundCard";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { Spinner } from "@/components/ui/Spinner";

export default function ProfessorDashboard() {
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
        subtitle="Panel de gestión académica."
      />

      {/* ── Sección: Insignias ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.badge}>Insignias</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Tipos de insignia creados"
            value="—"
            subtitle="Definidos por ti"
            icon={icons.badge}
          />
          <StatCard
            title="Insignias otorgadas"
            value="—"
            subtitle="A alumnos"
            icon={icons.student}
          />
        </div>
      </section>

      {/* ── Sección: Tareas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.task}>Tareas</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Tareas activas"
            value="—"
            subtitle="Disponibles para alumnos"
            icon={icons.task}
          />
          <StatCard
            title="Tareas completadas"
            value="—"
            subtitle="Por alumnos"
            icon={icons.task}
          />
        </div>
      </section>

      {/* ── Sección: Recompensas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.reward}>Recompensas</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Recompensas creadas"
            value="—"
            subtitle="Disponibles para canjear"
            icon={icons.reward}
          />

          <CompoundCard
            icon={icons.pending}
            title="Solicitudes de uso"
            slots={[
              { value: "—", label: "Pendientes", color: "text-warning" },
              { value: "—", label: "Aprobadas", color: "text-success" },
              { value: "—", label: "Rechazadas", color: "text-danger" },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
