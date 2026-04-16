"use client";

/**
 * Dashboard del BIBLIOTECARIO.
 * Panel completo con estadísticas, gráficos (Recharts), actividad reciente y accesos rápidos.
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
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TYPE_LABELS } from "@/lib/library-constants";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

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

// ── Constantes ────────────────────────────────────────────────────────────

const PIE_COLORS: Record<string, string> = {
  BOOK: "#3b82f6",
  BOARD_GAME: "#8b5cf6",
  VIDEO_GAME: "#f59e0b",
  OTHER: "#6b7280",
};

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

  if (authLoading || !user) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  const ls = libraryStats;
  const rs = roomStats;
  const val = (v: number | undefined) => loading ? "—" : String(v ?? 0);

  return (
    <div className="space-y-10">
      <DashboardGreeting name={user.name} subtitle="Panel de gestión de la biblioteca." />

      {/* ── Alerta de préstamos vencidos ── */}
      {ls && ls.overdueLoans > 0 && (
        <Link href="/librarian/loans?status=PICKED_UP" className="block">
          <Card className="flex items-center gap-4 border-warning/50 bg-warning/5 hover:border-warning transition-colors">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning">
              {icons.alert}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-text">
                {ls.overdueLoans} préstamo{ls.overdueLoans !== 1 ? "s" : ""} vencido{ls.overdueLoans !== 1 ? "s" : ""}
              </p>
              <p className="text-sm text-text-muted">Requieren acción inmediata — revisar y forzar devolución si es necesario</p>
            </div>
            <span className="text-sm text-warning font-medium shrink-0">Ver préstamos →</span>
          </Card>
        </Link>
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
            {/* Gráfico de barras — Préstamos por mes */}
            <Card className="space-y-3">
              <h3 className="font-medium text-text">Préstamos por mes</h3>
              {ls.loansByMonth.some((m) => m.count > 0) ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ls.loansByMonth} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-default)", borderRadius: 8, fontSize: 13 }}
                        labelStyle={{ color: "var(--color-text)" }}
                        itemStyle={{ color: "var(--color-primary)" }}
                        formatter={(value) => [`${value} préstamos`, ""]}
                      />
                      <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-text-muted py-8 text-center">No hay datos de préstamos en los últimos 6 meses</p>
              )}
            </Card>

            {/* Gráfico circular — Distribución del catálogo */}
            <Card className="space-y-3">
              <h3 className="font-medium text-text">Distribución del catálogo</h3>
              {ls.itemsByType.length > 0 ? (
                <div className="flex items-center gap-6">
                  <div className="h-48 w-48 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={ls.itemsByType}
                          dataKey="count"
                          nameKey="type"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {ls.itemsByType.map((entry) => (
                            <Cell key={entry.type} fill={PIE_COLORS[entry.type] || "#6b7280"} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-default)", borderRadius: 8, fontSize: 13 }}
                          formatter={(value, _name, props) => [
                            `${value} ítems`,
                            TYPE_LABELS[(props as { payload: { type: string } }).payload.type] || (props as { payload: { type: string } }).payload.type,
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 flex-1">
                    {ls.itemsByType.map((entry) => (
                      <div key={entry.type} className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[entry.type] || "#6b7280" }}
                        />
                        <span className="text-sm text-text flex-1">{TYPE_LABELS[entry.type] || entry.type}</span>
                        <span className="text-sm font-medium text-text-muted">{entry.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-muted py-8 text-center">No hay ítems en el catálogo</p>
              )}
            </Card>
          </div>
        </section>
      )}

      {/* ── Datos detallados ── */}
      {ls && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Top 5 ítems más prestados */}
            <Card className="space-y-3">
              <h3 className="font-medium text-text">Top ítems más prestados</h3>
              {ls.topItems.length > 0 ? (
                <div className="space-y-2">
                  {ls.topItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <span className="text-sm font-bold text-text-muted w-5 text-right">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text truncate">{item.title}</p>
                        <p className="text-xs text-text-muted">{TYPE_LABELS[item.type] || item.type}</p>
                      </div>
                      <span className="text-sm font-semibold text-primary shrink-0">{item.loanCount}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted py-4 text-center">Sin datos de préstamos</p>
              )}
            </Card>

            {/* Actividad reciente */}
            <Card className="space-y-3">
              <h3 className="font-medium text-text">Actividad reciente</h3>
              {ls.recentLoans.length > 0 ? (
                <div className="space-y-2">
                  {ls.recentLoans.map((loan, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text truncate">{loan.title}</p>
                        <p className="text-xs text-text-muted">{loan.userName}</p>
                      </div>
                      <StatusBadge status={loan.status} />
                      <span className="text-xs text-text-muted shrink-0">
                        {new Date(loan.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted py-4 text-center">Sin actividad reciente</p>
              )}
            </Card>
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
