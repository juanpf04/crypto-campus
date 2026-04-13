"use client";

/**
 * Dashboard del PROFESOR.
 *
 * Secciones basadas en sus funcionalidades del contrato BadgeSystem:
 * - Insignias: tipos creados, badges otorgados
 * - Tareas: tareas activas, tareas completadas por alumnos
 * - Recompensas: recompensas creadas, solicitudes pendientes de aprobación
 */

import { useCallback, useEffect, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useToast } from "@/hooks/useToast";
import { icons } from "@/components/ui/icons";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { CompoundCard } from "@/components/shared/CompoundCard";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { Spinner } from "@/components/ui/Spinner";

interface DashboardStats {
  totalBadgeTypes: number;
  totalTasks: number;
  activeTasks: number;
  totalAwards: number;
  totalRewards: number;
  totalRedemptions: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
}

const INITIAL_STATS: DashboardStats = {
  totalBadgeTypes: 0, totalTasks: 0, activeTasks: 0, totalAwards: 0,
  totalRewards: 0, totalRedemptions: 0,
  pendingRequests: 0, approvedRequests: 0, rejectedRequests: 0,
};

export default function ProfessorDashboard() {
  const { user, loading: authLoading } = useAuthUser();
  const { addToast } = useToast();

  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/badges/stats");
      if (res.ok) setStats(await res.json());
    } catch {
      addToast("Error al cargar estadísticas", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <DashboardGreeting
        name={user?.name ?? "Profesor"}
        subtitle="Panel de gestión académica."
      />

      {/* ── Sección: Insignias ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.badge}>Insignias</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Tipos de insignia creados"
            value={stats.totalBadgeTypes}
            subtitle="Definidos por ti"
            icon={icons.badge}
          />
          <StatCard
            title="Insignias otorgadas"
            value={stats.totalAwards}
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
            value={stats.activeTasks}
            subtitle="Disponibles para alumnos"
            icon={icons.task}
          />
          <StatCard
            title="Tareas completadas"
            value={stats.totalAwards}
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
            value={stats.totalRewards}
            subtitle="Disponibles para canjear"
            icon={icons.reward}
          />

          <CompoundCard
            icon={icons.pending}
            title="Solicitudes de uso"
            slots={[
              { value: stats.pendingRequests, label: "Pendientes", color: "text-warning" },
              { value: stats.approvedRequests, label: "Aprobadas", color: "text-success" },
              { value: stats.rejectedRequests, label: "Rechazadas", color: "text-danger" },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
