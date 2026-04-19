"use client";

/**
 * Dashboard del BIBLIOTECARIO.
 * Panel completo con estadísticas, gráficos (Recharts), actividad reciente y accesos rápidos.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { icons } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { CompoundCard } from "@/components/shared/CompoundCard";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { ActionRow } from "@/components/shared/ActionRow";
import { AlertCalloutCard } from "@/components/shared/AlertCalloutCard";
import { DashboardBarChart } from "@/components/shared/DashboardBarChart";
import { DashboardPieChart } from "@/components/shared/DashboardPieChart";
import { TopListCard } from "@/components/shared/TopListCard";
import { RecentActivityCard } from "@/components/shared/RecentActivityCard";
import { TYPE_LABELS } from "@/lib/library-constants";
import { LIBRARY_TYPE_COLORS } from "@/lib/dashboard-colors";

// ── Tipos ─────────────────────────────────────────────────────────────────

interface LibraryStats {
  totalItems: number;
  activeItems: number;
  totalLoans: number;
  queuedLoans: number;
  pendingPickups: number;
  activeLoans: number;
  overdueLoans: number;
  onTimeRate: number;
  loansByMonth: { month: string; count: number }[];
  itemsByType: { type: string; count: number }[];
  topItems: { title: string; type: string; loanCount: number }[];
  recentLoans: { title: string; userName: string; status: string; date: string }[];
}

interface RoomStats {
  totalRooms: number;
  activeRooms: number;
  totalBookings: number;
  todayBookings: number;
  cancelledBookings: number;
}

// ── Componente ────────────────────────────────────────────────────────────

export default function LibrarianDashboard() {
  const { user, loading: authLoading } = useAuthUser();
  const [libraryStats, setLibraryStats] = useState<LibraryStats | null>(null);
  const [roomStats, setRoomStats] = useState<RoomStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const [libRes, roomRes] = await Promise.all([
        fetch("/api/library/stats"),
        fetch("/api/rooms/stats"),
      ]);
      if (libRes.ok) setLibraryStats(await libRes.json());
      if (roomRes.ok) setRoomStats(await roomRes.json());
    } catch {
      // Stats no críticas
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (authLoading || !user) return <SkeletonPage />;

  const ls = libraryStats;
  const rs = roomStats;
  const val = (v: number | undefined) => loading ? "—" : String(v ?? 0);

  return (
    <div className="space-y-10">
      <DashboardGreeting name={user.name} subtitle="Panel de gestión de la biblioteca." />

      {/* ── Alerta de préstamos vencidos ── */}
      {ls && ls.overdueLoans > 0 && (
        <AlertCalloutCard
          variant="warning"
          icon={icons.alert}
          title={`${ls.overdueLoans} préstamo${ls.overdueLoans !== 1 ? "s" : ""} vencido${ls.overdueLoans !== 1 ? "s" : ""}`}
          description="Requieren acción inmediata — revisar y forzar devolución si es necesario"
          actionText="Ver préstamos"
          href="/librarian/loans?status=PICKED_UP"
        />
      )}

      {/* ── Resumen rápido ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.library}>Resumen</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Reservas por recoger" value={val(ls?.pendingPickups)} subtitle={`${ls?.queuedLoans ?? 0} en cola`} icon={icons.pending} />
          <StatCard title="Préstamos activos" value={val(ls?.activeLoans)} subtitle={`${ls?.overdueLoans ?? 0} vencidos`} icon={icons.loans} />
          <CompoundCard icon={icons.history} title="Histórico" slots={[
            { value: val(ls?.totalLoans), label: "Total", color: "text-text" },
            { value: `${ls?.onTimeRate ?? 100}%`, label: "Puntualidad", color: (ls?.onTimeRate ?? 100) >= 80 ? "text-success" : "text-warning" },
          ]} />
          <StatCard title="Catálogo activo" value={val(ls?.activeItems)} subtitle={`${ls?.totalItems ?? 0} registrados`} icon={icons.items} />
        </div>
      </section>

      {/* ── Gráficos ── */}
      {ls && (
        <section className="space-y-4">
          <SectionTitle icon={icons.history}>Actividad</SectionTitle>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DashboardBarChart
              title="Préstamos por mes"
              data={ls.loansByMonth}
              emptyMessage="No hay datos de préstamos en los últimos 6 meses"
              formatter={(v) => `${v} préstamos`}
            />

            <DashboardPieChart
              title="Distribución del catálogo"
              data={ls.itemsByType}
              dataKey="count"
              nameKey="type"
              colorMap={LIBRARY_TYPE_COLORS}
              labelMap={TYPE_LABELS}
              unitLabel="ítems"
              emptyMessage="No hay ítems en el catálogo"
            />
          </div>
        </section>
      )}

      {/* ── Datos detallados ── */}
      {ls && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TopListCard
              title="Top ítems más prestados"
              items={ls.topItems.map((i) => ({
                title: i.title,
                subtitle: TYPE_LABELS[i.type] || i.type,
                stat: i.loanCount,
              }))}
              emptyMessage="Sin datos de préstamos"
            />

            <RecentActivityCard
              title="Actividad reciente"
              items={ls.recentLoans.map((l) => ({
                id: l.title + l.date,
                title: l.title,
                subtitle: l.userName,
                status: l.status,
                date: l.date,
              }))}
              emptyMessage="Sin actividad reciente"
            />
          </div>
        </section>
      )}

      {/* ── Acciones rápidas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Gestión</SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden p-0">
            <ActionRow href="/librarian/items" icon={icons.items} title="Catálogo" description="Ver y gestionar ítems del catálogo" stat={`${ls?.activeItems ?? "—"} activos`} />
          </Card>
          <Card className="overflow-hidden p-0">
            <ActionRow href="/librarian/items/new" icon={icons.library} title="Añadir ítem" description="Registrar nuevo libro, juego o recurso" stat="" />
          </Card>
          <Card className="overflow-hidden p-0">
            <ActionRow href="/librarian/loans/pickups" icon={icons.pending} title="Reservas pendientes" description="Confirmar recogidas y expirar reservas" stat={`${ls?.pendingPickups ?? "—"} pendientes`} />
          </Card>
          <Card className="overflow-hidden p-0">
            <ActionRow href="/librarian/loans/returns" icon={icons.loans} title="Devoluciones pendientes" description="Confirmar devoluciones de préstamos activos" stat={`${ls?.activeLoans ?? "—"} activos`} />
          </Card>
          <Card className="overflow-hidden p-0 lg:col-span-2">
            <ActionRow href="/librarian/loans" icon={icons.history} title="Todos los préstamos" description="Ver historial completo de préstamos" stat={`${ls?.totalLoans ?? "—"} total`} />
          </Card>
        </div>
      </section>

      {/* ── Salas de estudio ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.rooms}>Salas de estudio</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Salas activas" value={val(rs?.activeRooms)} subtitle={`${rs?.totalRooms ?? 0} total`} icon={icons.rooms} />
          <StatCard title="Reservas hoy" value={val(rs?.todayBookings)} subtitle="Para el día de hoy" icon={icons.calendar} />
          <StatCard title="Reservas totales" value={val(rs?.totalBookings)} subtitle={`${rs?.cancelledBookings ?? 0} canceladas`} icon={icons.history} />
        </div>
        <Card className="overflow-hidden p-0">
          <ActionRow href="/librarian/rooms" icon={icons.rooms} title="Gestionar salas" description="Crear, editar y desactivar salas" stat={`${rs?.activeRooms ?? "—"} activas`} />
          <ActionRow href="/librarian/rooms/new" icon={icons.rooms} title="Crear sala" description="Añadir nueva sala de estudio" stat="" isLast />
        </Card>
      </section>

      {/* ── Impresión ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.print}>Impresión</SectionTitle>
        <Card className="overflow-hidden p-0">
          <ActionRow href="/librarian/printing/printers" icon={icons.print} title="Impresoras" description="Añadir, editar y desactivar impresoras" stat="" />
          <ActionRow href="/librarian/printing/logs" icon={icons.orders} title="Historial de impresiones" description="Ver todas las impresiones" stat="" />
          <ActionRow href="/librarian/printing/print" icon={icons.file} title="Imprimir" description="Imprimir un documento" stat="" isLast />
        </Card>
      </section>
    </div>
  );
}
