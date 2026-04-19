"use client";

/**
 * Dashboard del ADMIN.
 * Panel completo con alertas, estadísticas, gráficos (Recharts), top items,
 * actividad reciente y accesos rápidos por dominio.
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
import { USER_ROLE_COLORS } from "@/lib/dashboard-colors";

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

interface BadgeStats {
  totalSubjectBadges: number;
  totalAwards: number;
  totalRewards: number;
  totalRedemptions: number;
  pendingRequests: number;
}

interface ShopStats {
  activeProducts: number;
  totalProducts: number;
  totalOrders: number;
  tokensInCirculation: number;
  PAID: number;
  DELIVERED: number;
  RETURNED: number;
}

interface UserCounts {
  total: number;
  students: number;
  professors: number;
  librarians: number;
  admins: number;
}

// ── Componente ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuthUser();
  const [libraryStats, setLibraryStats] = useState<LibraryStats | null>(null);
  const [roomStats, setRoomStats] = useState<RoomStats | null>(null);
  const [badgeStats, setBadgeStats] = useState<BadgeStats | null>(null);
  const [shopStats, setShopStats] = useState<ShopStats | null>(null);
  const [userCounts, setUserCounts] = useState<UserCounts | null>(null);
  const [activePrinters, setActivePrinters] = useState<number>(0);
  const [totalPrintLogs, setTotalPrintLogs] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const [libRes, roomRes, badgeRes, shopRes, usersRes, printersRes, printLogsRes] = await Promise.all([
        fetch("/api/library/stats"),
        fetch("/api/rooms/stats"),
        fetch("/api/badges/stats"),
        fetch("/api/shop/stats"),
        fetch("/api/admin/users"),
        fetch("/api/printer"),
        fetch("/api/printer/logs/admin?limit=500&offset=0"),
      ]);

      if (libRes.ok) setLibraryStats(await libRes.json());
      if (roomRes.ok) setRoomStats(await roomRes.json());
      if (badgeRes.ok) setBadgeStats(await badgeRes.json());
      if (shopRes.ok) setShopStats(await shopRes.json());

      if (usersRes.ok) {
        const data = await usersRes.json();
        const users = data.users ?? [];
        setUserCounts({
          total: users.length,
          students: users.filter((u: { role: string }) => u.role === "STUDENT").length,
          professors: users.filter((u: { role: string }) => u.role === "PROFESSOR").length,
          librarians: users.filter((u: { role: string }) => u.role === "LIBRARIAN").length,
          admins: users.filter((u: { role: string }) => u.role === "ADMIN").length,
        });
      }

      if (printersRes.ok) {
        const data = await printersRes.json();
        setActivePrinters(Array.isArray(data) ? data.length : 0);
      }
      if (printLogsRes.ok) {
        const data = await printLogsRes.json();
        setTotalPrintLogs(Array.isArray(data) ? data.length : 0);
      }
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
  const bs = badgeStats;
  const ss = shopStats;
  const uc = userCounts;
  const val = (v: number | undefined) => loading ? "—" : String(v ?? 0);

  // Datos para el PieChart de usuarios por rol
  const usersByRole = uc ? [
    { role: "Estudiantes", count: uc.students },
    { role: "Profesores", count: uc.professors },
    { role: "Bibliotecarios", count: uc.librarians },
    { role: "Admins", count: uc.admins },
  ].filter((r) => r.count > 0) : [];

  return (
    <div className="space-y-10">
      <DashboardGreeting name={user.name} subtitle="Panel de administración de CryptoCampus." />

      {/* ── Alertas contextuales ── */}
      {(ls && ls.overdueLoans > 0) || (bs && bs.pendingRequests > 0) || (ss && ss.PAID > 5) ? (
        <div className="space-y-3">
          {ls && ls.overdueLoans > 0 && (
            <AlertCalloutCard
              variant="warning"
              icon={icons.alert}
              title={`${ls.overdueLoans} préstamo${ls.overdueLoans !== 1 ? "s" : ""} vencido${ls.overdueLoans !== 1 ? "s" : ""}`}
              description="Revisar y forzar devolución si es necesario"
              actionText="Ver préstamos"
              href="/admin/library/loans?status=PICKED_UP"
            />
          )}
          {bs && bs.pendingRequests > 0 && (
            <AlertCalloutCard
              variant="info"
              icon={icons.pending}
              title={`${bs.pendingRequests} solicitud${bs.pendingRequests !== 1 ? "es" : ""} de recompensa pendiente${bs.pendingRequests !== 1 ? "s" : ""}`}
              description="Revisar y aprobar o rechazar"
              actionText="Ver solicitudes"
              href="/admin/badges/rewards/requests"
            />
          )}
          {ss && ss.PAID > 5 && (
            <AlertCalloutCard
              variant="info"
              icon={icons.orders}
              title={`${ss.PAID} pedido${ss.PAID !== 1 ? "s" : ""} pendiente${ss.PAID !== 1 ? "s" : ""} de entrega`}
              description="Gestionar entregas en la tienda"
              actionText="Ver pedidos"
              href="/admin/shop/orders?status=PAID"
            />
          )}
        </div>
      ) : null}

      {/* ── Resumen ejecutivo ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Resumen</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Usuarios totales"
            value={val(uc?.total)}
            subtitle={`${uc?.students ?? 0} estudiantes`}
            icon={icons.users}
          />
          <CompoundCard
            icon={icons.student}
            title="Por rol"
            slots={[
              { value: uc?.students ?? 0, label: "Estudiantes", color: "text-primary" },
              { value: uc?.professors ?? 0, label: "Profesores", color: "text-success" },
              { value: uc?.librarians ?? 0, label: "Biblioteca", color: "text-warning" },
              { value: uc?.admins ?? 0, label: "Admins", color: "text-danger" },
            ]}
          />
          <CompoundCard
            icon={icons.token}
            title="Tokens en circulación"
            slots={[
              { value: val(ss?.tokensInCirculation), label: "SHOP", color: "text-primary" },
              { value: val(bs?.totalAwards), label: "Badges", color: "text-warning" },
            ]}
          />
          <StatCard
            title="Préstamos activos"
            value={val(ls?.activeLoans)}
            subtitle={`${ls?.onTimeRate ?? 100}% puntualidad`}
            icon={icons.loans}
          />
        </div>
      </section>

      {/* ── Gráficos ── */}
      {ls && (
        <section className="space-y-4">
          <SectionTitle icon={icons.history}>Actividad del sistema</SectionTitle>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DashboardBarChart
              title="Préstamos por mes"
              data={ls.loansByMonth}
              emptyMessage="No hay datos de préstamos en los últimos 6 meses"
              formatter={(v) => `${v} préstamos`}
            />

            <DashboardPieChart
              title="Usuarios por rol"
              data={usersByRole}
              dataKey="count"
              nameKey="role"
              colorMap={USER_ROLE_COLORS}
              unitLabel="usuarios"
              emptyMessage="No hay usuarios registrados"
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

      {/* ── Gestión por dominio ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Gestión</SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Usuarios */}
          <Card className="overflow-hidden p-0">
            <ActionRow href="/admin/users" icon={icons.users} title="Usuarios" description="Gestionar cuentas y roles" stat={`${uc?.total ?? "—"} total`} />
            <ActionRow href="/admin/users/new" icon={icons.student} title="Crear usuario" description="Añadir nueva cuenta" stat="" isLast />
          </Card>

          {/* Biblioteca */}
          <Card className="overflow-hidden p-0">
            <ActionRow href="/admin/library/items" icon={icons.library} title="Catálogo" description="Ítems y colecciones" stat={`${ls?.activeItems ?? "—"} activos`} />
            <ActionRow href="/admin/library/loans" icon={icons.loans} title="Préstamos" description="Historial de préstamos" stat={`${ls?.totalLoans ?? "—"} total`} />
            <ActionRow href="/admin/library/rooms" icon={icons.rooms} title="Salas" description="Gestión de salas de estudio" stat={`${rs?.activeRooms ?? "—"} activas`} isLast />
          </Card>

          {/* Tienda */}
          <Card className="overflow-hidden p-0">
            <ActionRow href="/admin/shop/products" icon={icons.shop} title="Productos" description="Catálogo de la tienda" stat={`${ss?.activeProducts ?? "—"} activos`} />
            <ActionRow href="/admin/shop/orders" icon={icons.orders} title="Pedidos" description="Gestión de pedidos" stat={`${ss?.totalOrders ?? "—"} total`} />
            <ActionRow href="/admin/shop/transactions" icon={icons.token} title="Transacciones" description="Movimientos de ShopTokens" stat="" isLast />
          </Card>

          {/* Insignias */}
          <Card className="overflow-hidden p-0">
            <ActionRow href="/admin/badges" icon={icons.badge} title="Insignias" description="Tipos de badge y tareas" stat={`${bs?.totalSubjectBadges ?? "—"} tipos`} />
            <ActionRow href="/admin/badges/rewards" icon={icons.reward} title="Recompensas" description="Catálogo de recompensas" stat={`${bs?.totalRewards ?? "—"} total`} />
            <ActionRow href="/admin/badges/rewards/requests" icon={icons.pending} title="Solicitudes" description="Aprobar/rechazar canjes" stat={`${bs?.pendingRequests ?? "—"} pendientes`} isLast />
          </Card>

          {/* Impresión */}
          <Card className="overflow-hidden p-0 lg:col-span-2">
            <ActionRow href="/admin/printing/printers" icon={icons.print} title="Impresoras" description="Gestionar impresoras físicas" stat={`${activePrinters} activas`} />
            <ActionRow href="/admin/printing/logs" icon={icons.history} title="Historial de impresiones" description="Ver todas las impresiones" stat={`${totalPrintLogs} registros`} isLast />
          </Card>
        </div>
      </section>
    </div>
  );
}
