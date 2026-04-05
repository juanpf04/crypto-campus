"use client";

/**
 * Dashboard del BIBLIOTECARIO.
 * Secciones: Catálogo, Préstamos, Salas con stats reales y accesos rápidos.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { icons } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { CompoundCard } from "@/components/shared/CompoundCard";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { ActionRow } from "@/components/shared/ActionRow";

interface LibraryStats {
  totalItems: number;
  activeItems: number;
  totalLoans: number;
  pendingRequests: number;
  activeLoans: number;
  overdueLoans: number;
}

interface RoomStats {
  totalRooms: number;
  activeRooms: number;
  totalBookings: number;
  todayBookings: number;
  cancelledBookings: number;
}

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

  if (authLoading || !user) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  const ls = libraryStats;
  const rs = roomStats;
  const val = (v: number | undefined) => loading ? "—" : String(v ?? 0);

  return (
    <div className="space-y-10">
      <DashboardGreeting name={user.name} subtitle="Panel de gestión de la biblioteca." />

      {/* ── Catálogo ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Catálogo</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Ítems en catálogo" value={val(ls?.activeItems)} subtitle="Títulos activos" icon={icons.library} />
          <StatCard title="Total registrados" value={val(ls?.totalItems)} subtitle="Incluyendo inactivos" icon={icons.items} />
        </div>
        <Card className="overflow-hidden p-0">
          <ActionRow href="/dashboard/librarian/items" icon={icons.items} title="Catálogo" description="Ver y gestionar ítems del catálogo" stat={`${ls?.activeItems ?? "—"} activos`} />
          <ActionRow href="/dashboard/librarian/items/new" icon={icons.library} title="Añadir ítem" description="Registrar nuevo libro, juego o recurso" stat="" isLast />
        </Card>
      </section>

      {/* ── Préstamos ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.loans}>Préstamos</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CompoundCard icon={icons.loans} title="Estado de préstamos" slots={[
            { value: val(ls?.pendingRequests), label: "Solicitudes", color: "text-warning" },
            { value: val(ls?.activeLoans), label: "Activos", color: "text-primary" },
            { value: val(ls?.overdueLoans), label: "Vencidos", color: "text-danger" },
          ]} />
          <StatCard title="Préstamos totales" value={val(ls?.totalLoans)} subtitle="Histórico completo" icon={icons.history} />
        </div>
        <Card className="overflow-hidden p-0">
          <ActionRow href="/dashboard/librarian/loans" icon={icons.loans} title="Préstamos" description="Ver todos los préstamos" stat={`${ls?.activeLoans ?? "—"} activos`} />
          <ActionRow href="/dashboard/librarian/loans/requests" icon={icons.pending} title="Solicitudes pendientes" description="Aprobar o rechazar solicitudes" stat={`${ls?.pendingRequests ?? "—"} pendientes`} isLast />
        </Card>
      </section>

      {/* ── Salas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.rooms}>Salas de estudio</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Salas activas" value={val(rs?.activeRooms)} subtitle={`${rs?.totalRooms ?? 0} total`} icon={icons.rooms} />
          <StatCard title="Reservas hoy" value={val(rs?.todayBookings)} subtitle="Para el día de hoy" icon={icons.calendar} />
          <StatCard title="Reservas totales" value={val(rs?.totalBookings)} subtitle={`${rs?.cancelledBookings ?? 0} canceladas`} icon={icons.history} />
        </div>
        <Card className="overflow-hidden p-0">
          <ActionRow href="/dashboard/librarian/rooms" icon={icons.rooms} title="Gestionar salas" description="Crear, editar y desactivar salas" stat={`${rs?.activeRooms ?? "—"} activas`} />
          <ActionRow href="/dashboard/librarian/rooms/new" icon={icons.rooms} title="Crear sala" description="Añadir nueva sala de estudio" stat="" isLast />
        </Card>
      </section>
    </div>
  );
}
