"use client";

/**
 * Panel de administración de insignias.
 *
 * Visión global del sistema de badges para el admin:
 * - 5 StatCards con métricas globales (tipos, tareas, otorgamientos, recompensas, canjes)
 * - ActionRows de acceso rápido a gestión de tipos, recompensas y solicitudes
 */

import { useCallback, useEffect, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { ActionRow } from "@/components/shared/ActionRow";
import { icons } from "@/components/ui/icons";

interface BadgeStats {
  totalBadgeTypes: number;
  totalTasks: number;
  totalAwards: number;
  totalRewards: number;
  totalRedemptions: number;
}

export default function AdminBadgesPage() {
  const { user, loading: authLoading } = useAuthUser();
  const { addToast } = useToast();
  const [stats, setStats] = useState<BadgeStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/badges/stats");
      if (res.ok) setStats(await res.json());
    } catch {
      addToast("Error al cargar estadísticas de insignias", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const val = (v: number | undefined) => loading ? "—" : String(v ?? 0);

  return (
    <div className="space-y-10">
      <BackLink href="/admin" label="Volver al panel" />

      <div>
        <h1 className="text-2xl font-bold text-text">Insignias</h1>
        <p className="text-text-muted mt-1">
          Gestión global del sistema de insignias, tareas y recompensas.
        </p>
      </div>

      {/* ── Estadísticas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.badge}>Resumen</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Tipos de insignia"
            value={val(stats?.totalBadgeTypes)}
            subtitle="Creados por profesores"
            icon={icons.badge}
          />
          <StatCard
            title="Tareas"
            value={val(stats?.totalTasks)}
            subtitle="En todos los tipos"
            icon={icons.task}
          />
          <StatCard
            title="Otorgamientos"
            value={val(stats?.totalAwards)}
            subtitle="Insignias otorgadas"
            icon={icons.student}
          />
          <StatCard
            title="Recompensas"
            value={val(stats?.totalRewards)}
            subtitle="Definidas"
            icon={icons.reward}
          />
          <StatCard
            title="Canjes"
            value={val(stats?.totalRedemptions)}
            subtitle="Recompensas canjeadas"
            icon={icons.token}
          />
        </div>
      </section>

      {/* ── Acciones rápidas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Gestión</SectionTitle>
        <Card className="overflow-hidden p-0">
          <ActionRow
            href="/admin/badges/types"
            icon={icons.badge}
            title="Tipos de insignia"
            description="Ver, crear y gestionar todos los tipos de insignia"
            stat={`${val(stats?.totalBadgeTypes)} tipos`}
          />
          <ActionRow
            href="/admin/badges/rewards"
            icon={icons.reward}
            title="Recompensas"
            description="Ver y crear recompensas canjeables por insignias"
            stat={`${val(stats?.totalRewards)} recompensas`}
          />
          <ActionRow
            href="/admin/badges/rewards/requests"
            icon={icons.pending}
            title="Solicitudes de uso"
            description="Aprobar o rechazar solicitudes de uso de recompensas"
            stat=""
            isLast
          />
        </Card>
      </section>
    </div>
  );
}
