"use client";

/**
 * Dashboard de biblioteca para ADMIN — hub multi-módulo.
 * Recibe los estados de los módulos (library/rooms/print) precalculados
 * server-side y oculta/reemplaza secciones cuando alguno está pausado.
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

interface AdminLibraryHubClientProps {
  libraryActive: boolean;
  roomsActive: boolean;
  printActive: boolean;
}

export function AdminLibraryHubClient({
  libraryActive,
  roomsActive,
  printActive,
}: AdminLibraryHubClientProps) {
  const { user, loading: authLoading } = useAuthUser();
  const [ls, setLs] = useState<LibraryStats | null>(null);
  const [rs, setRs] = useState<RoomStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    // Solo pedimos stats de módulos activos.
    try {
      const [libRes, roomRes] = await Promise.all([
        libraryActive ? fetch("/api/library/stats") : Promise.resolve(null),
        roomsActive ? fetch("/api/rooms/stats") : Promise.resolve(null),
      ]);
      if (libRes && libRes.ok) setLs(await libRes.json());
      if (roomRes && roomRes.ok) setRs(await roomRes.json());
    } catch { /* no-op */ } finally { setLoading(false); }
  }, [libraryActive, roomsActive]);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (authLoading || !user) return <SkeletonPage />;

  const val = (v: number | undefined) => loading ? "—" : String(v ?? 0);

  return (
    <div className="space-y-10">
      <DashboardGreeting
        name={user.name}
        subtitle="Gestión de la biblioteca del campus"
      />

      {/* ── Estadísticas generales ──
          Cada StatCard se oculta si su módulo está pausado. */}
      <section className="space-y-4">
        <SectionTitle icon={icons.library}>Resumen</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {libraryActive && (
            <StatCard
              title="Reservas por recoger"
              value={val(ls?.pendingPickups)}
              subtitle={`${ls?.activeLoans ?? 0} prestados, ${ls?.overdueLoans ?? 0} vencidos`}
              icon={icons.loans}
            />
          )}
          {roomsActive && (
            <StatCard
              title="Salas activas"
              value={val(rs?.activeRooms)}
              subtitle={`${rs?.todayBookings ?? 0} reservas hoy`}
              icon={icons.rooms}
            />
          )}
          {libraryActive && (
            <StatCard
              title="Préstamos totales"
              value={val(ls?.totalLoans)}
              subtitle="Histórico completo"
              icon={icons.history}
            />
          )}
        </div>
        {!libraryActive && !roomsActive && (
          <Card className="text-center py-6 text-text-muted text-sm border-danger/40 bg-danger/5">
            Biblioteca y Salas están pausadas. Despáusalas en{" "}
            <a href="/admin/system" className="font-medium text-primary underline">
              estado del sistema
            </a>{" "}
            para ver el resumen.
          </Card>
        )}
      </section>

      {/* ── Acciones rápidas ──
          Cada ActionRow se oculta si su módulo está pausado. */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Gestión</SectionTitle>
        <Card className="overflow-hidden p-0">
          {libraryActive && (
            <ActionRow
              href="/admin/library/items"
              icon={icons.library}
              title="Catálogo"
              description="Añadir, editar y gestionar libros, juegos y recursos"
              stat={`${ls?.activeItems ?? "—"} activos`}
            />
          )}
          {libraryActive && (
            <ActionRow
              href="/admin/library/loans"
              icon={icons.loans}
              title="Préstamos"
              description="Gestionar recogidas, devoluciones y cola de espera"
              stat={`${ls?.pendingPickups ?? "—"} por recoger`}
            />
          )}
          {roomsActive && (
            <ActionRow
              href="/admin/library/rooms"
              icon={icons.rooms}
              title="Salas de estudio"
              description="Crear, editar y gestionar salas de la biblioteca"
              stat={`${rs?.activeRooms ?? "—"} activas`}
            />
          )}
          {libraryActive && (
            <ActionRow
              href="/admin/library/tokens"
              icon={icons.token}
              title="Tokens de Préstamo"
              description="Consultar y asignar tokens de préstamo a estudiantes"
              stat=""
            />
          )}
          {printActive && (
            <ActionRow
              href="/admin/printing"
              icon={icons.print}
              title="Impresión"
              description="Gestionar impresoras, créditos e historial"
              stat=""
              isLast
            />
          )}
          {!libraryActive && !roomsActive && !printActive && (
            <div className="py-8 text-center text-sm text-text-muted">
              Todas las secciones de este panel están pausadas. Despáusalas
              desde{" "}
              <a href="/admin/system" className="font-medium text-primary underline">
                estado del sistema
              </a>
              .
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
