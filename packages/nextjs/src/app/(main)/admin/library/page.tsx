"use client";

/**
 * Dashboard de biblioteca para ADMIN.
 * Patrón idéntico a admin/shop: resumen de stats + acciones rápidas por sección.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { icons } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { ActionRow } from "@/components/shared/ActionRow";

interface LibraryStats {
  totalItems: number; activeItems: number; totalLoans: number;
  queuedLoans: number; pendingPickups: number; activeLoans: number; overdueLoans: number;
}

interface RoomStats {
  totalRooms: number; activeRooms: number; totalBookings: number;
  todayBookings: number; cancelledBookings: number;
}

export default function AdminLibraryPage() {
  const { user, loading: authLoading } = useAuthUser();
  const [ls, setLs] = useState<LibraryStats | null>(null);
  const [rs, setRs] = useState<RoomStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const [libRes, roomRes] = await Promise.all([
        fetch("/api/library/stats"), fetch("/api/rooms/stats"),
      ]);
      if (libRes.ok) setLs(await libRes.json());
      if (roomRes.ok) setRs(await roomRes.json());
    } catch { /* no-op */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (authLoading || !user) return <SkeletonPage />;

  const val = (v: number | undefined) => loading ? "—" : String(v ?? 0);

  return (
    <div className="space-y-10">
      <DashboardGreeting
        name={user.name}
        subtitle="Gestión de la biblioteca del campus"
      />

      {/* ── Estadísticas generales ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.library}>Resumen</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Reservas por recoger"
            value={val(ls?.pendingPickups)}
            subtitle={`${ls?.activeLoans ?? 0} prestados, ${ls?.overdueLoans ?? 0} vencidos`}
            icon={icons.loans}
          />
          <StatCard
            title="Salas activas"
            value={val(rs?.activeRooms)}
            subtitle={`${rs?.todayBookings ?? 0} reservas hoy`}
            icon={icons.rooms}
          />
          <StatCard
            title="Préstamos totales"
            value={val(ls?.totalLoans)}
            subtitle="Histórico completo"
            icon={icons.history}
          />
        </div>
      </section>

      {/* ── Acciones rápidas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Gestión</SectionTitle>
        <Card className="overflow-hidden p-0">
          <ActionRow
            href="/admin/library/items"
            icon={icons.library}
            title="Catálogo"
            description="Añadir, editar y gestionar libros, juegos y recursos"
            stat={`${ls?.activeItems ?? "—"} activos`}
          />
          <ActionRow
            href="/admin/library/loans"
            icon={icons.loans}
            title="Préstamos"
            description="Gestionar recogidas, devoluciones y cola de espera"
            stat={`${ls?.pendingPickups ?? "—"} por recoger`}
          />
          <ActionRow
            href="/admin/library/rooms"
            icon={icons.rooms}
            title="Salas de estudio"
            description="Crear, editar y gestionar salas de la biblioteca"
            stat={`${rs?.activeRooms ?? "—"} activas`}
          />
          <ActionRow
            href="/admin/library/tokens"
            icon={icons.token}
            title="LibraryTokens"
            description="Consultar y asignar tokens de préstamo a estudiantes"
            stat=""
          />
          <ActionRow
            href="/admin/printing"
            icon={icons.print}
            title="Impresión"
            description="Gestionar impresoras, créditos e historial"
            stat=""
            isLast
          />
        </Card>
      </section>
    </div>
  );
}
