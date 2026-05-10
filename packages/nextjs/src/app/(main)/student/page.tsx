"use client";

/**
 * Dashboard del ESTUDIANTE.
 * Panel personal con alertas (reservas/vencimientos), resumen, gráfico de
 * impresiones, actividad reciente (préstamos + pedidos) y accesos rápidos.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import { RecentActivityCard } from "@/components/shared/RecentActivityCard";
import { formatCredits, formatShortDate } from "@/lib/formatters";

// ── Tipos ─────────────────────────────────────────────────────────────────

interface Loan {
  id: string;
  status: string;
  dueDate: string | null;
  requestDate: string;
  libraryItem: { title: string };
}

interface Order {
  id: string;
  orderId: number;
  status: string;
  product: { name: string };
  totalPrice?: number;
  purchaseDate?: string;
  createdAt?: string;
}

interface BadgeSummary {
  earnedBadges: number;
  availableAssignments: number;
  pendingRedemptions: number;
  recentAwards: { prizeName: string; badgeReward: number; subjectName: string; date: string }[];
}

// ── Componente ────────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const { user, loading: authLoading } = useAuthUser();

  const [printCredits, setPrintCredits] = useState<number | null>(null);
  const [printCount, setPrintCount] = useState<number>(0);
  const [printsByMonth, setPrintsByMonth] = useState<{ month: string; count: number }[]>([]);
  const [libBalance, setLibBalance] = useState<number | null>(null);
  const [shopBalance, setShopBalance] = useState<number | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [badgeSummary, setBadgeSummary] = useState<BadgeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/student/stats");
      if (res.ok) {
        const data = await res.json();
        setPrintCredits(data.credits?.availableCredits ?? 0);
        setPrintCount(data.printCount ?? 0);
        setPrintsByMonth(Array.isArray(data.printsByMonth) ? data.printsByMonth : []);
        setLibBalance(data.libBalance ?? 0);
        setLoans(Array.isArray(data.loans) ? data.loans : []);
        setShopBalance(data.shopBalance?.balance ?? 0);
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        setBadgeSummary(data.badgeSummary ?? null);
      }
    } catch {
      // Stats no críticas
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (authLoading || !user) return <SkeletonPage />;

  const val = (v: number | null | undefined) => loading ? "—" : String(v ?? 0);

  // Préstamos activos y alertas
  const activeLoans = loans.filter((l) => l.status === "QUEUED" || l.status === "RESERVED" || l.status === "PICKED_UP");
  const readyToPickup = loans.filter((l) => l.status === "RESERVED");
  const now = Date.now();
  const overdueLoans = loans.filter((l) => l.status === "PICKED_UP" && l.dueDate && new Date(l.dueDate).getTime() < now);
  const dueSoon = loans.filter((l) => {
    if (l.status !== "PICKED_UP" || !l.dueDate) return false;
    const due = new Date(l.dueDate).getTime();
    const diff = due - now;
    return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000;
  });

  // Últimos préstamos (ordenados por requestDate desc, top 5)
  const recentLoans = [...loans]
    .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-10">
      <DashboardGreeting name={user.name} subtitle="Tu panel personal de CryptoCampus." />

      {/* ── Alertas personales ── */}
      {(overdueLoans.length > 0 || dueSoon.length > 0 || readyToPickup.length > 0) && (
        <div className="space-y-3">
          {overdueLoans.length > 0 && (
            <AlertCalloutCard
              variant="danger"
              icon={icons.alert}
              title={`${overdueLoans.length} préstamo${overdueLoans.length !== 1 ? "s" : ""} vencido${overdueLoans.length !== 1 ? "s" : ""}`}
              description="Devuélvelos cuanto antes para evitar sanciones"
              actionText="Ver préstamos"
              href="/student/library"
            />
          )}
          {dueSoon.length > 0 && (
            <AlertCalloutCard
              variant="warning"
              icon={icons.pending}
              title={`${dueSoon.length} préstamo${dueSoon.length !== 1 ? "s" : ""} vence${dueSoon.length !== 1 ? "n" : ""} pronto`}
              description="Devuélvelos en los próximos 3 días"
              actionText="Ver préstamos"
              href="/student/library"
            />
          )}
          {readyToPickup.length > 0 && (
            <AlertCalloutCard
              variant="success"
              icon={icons.library}
              title={`${readyToPickup.length} reserva${readyToPickup.length !== 1 ? "s" : ""} lista${readyToPickup.length !== 1 ? "s" : ""} para recoger`}
              description="Pasa por la biblioteca a recogerla"
              actionText="Ver préstamos"
              href="/student/library"
            />
          )}
        </div>
      )}

      {/* ── Mi resumen ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.student}>Mi resumen</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Créditos de impresión"
            value={printCredits !== null ? formatCredits(printCredits) : "—"}
            subtitle={`${printCount} impresiones realizadas`}
            icon={icons.print}
          />
          <CompoundCard
            icon={icons.token}
            title="Mis tokens"
            slots={[
              { value: val(libBalance), label: "Préstamos", color: "text-primary" },
              { value: val(shopBalance), label: "ShopTokens", color: "text-success" },
            ]}
          />
          <StatCard
            title="Préstamos activos"
            value={val(activeLoans.length)}
            subtitle={overdueLoans.length > 0 ? `${overdueLoans.length} vencidos` : "Ningún vencido"}
            icon={icons.loans}
          />
          <CompoundCard
            icon={icons.badge}
            title="Insignias"
            slots={[
              { value: val(badgeSummary?.earnedBadges), label: "Obtenidas", color: "text-warning" },
              { value: val(badgeSummary?.availableAssignments), label: "Tareas", color: "text-primary" },
            ]}
          />
        </div>
      </section>

      {/* ── Accesos rápidos ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.home}>Accede</SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Biblioteca */}
          <Card className="overflow-hidden p-0">
            <ActionRow href="/student/library" icon={icons.library} title="Biblioteca" description="Explorar catálogo y préstamos" stat={`${activeLoans.length} activos`} />
            <ActionRow href="/student/library/rooms" icon={icons.rooms} title="Salas de estudio" description="Reservar sala" stat="" isLast />
          </Card>

          {/* Tienda */}
          <Card className="overflow-hidden p-0">
            <ActionRow href="/student/shop" icon={icons.shop} title="Tienda" description="Comprar con ShopTokens" stat={`${val(shopBalance)} SHOP`} />
            <ActionRow href="/student/shop/orders" icon={icons.orders} title="Mis pedidos" description="Historial de compras" stat={`${orders.length} recientes`} isLast />
          </Card>

          {/* Impresión */}
          <Card className="overflow-hidden p-0">
            <ActionRow href="/student/library/printing" icon={icons.print} title="Imprimir" description="Enviar documento a impresora" stat={printCredits !== null ? `${formatCredits(printCredits)} créditos` : "—"} />
            <ActionRow href="/student/library/printing/history" icon={icons.history} title="Historial" description="Ver impresiones anteriores" stat={`${printCount} total`} isLast />
          </Card>

          {/* Insignias */}
          <Card className="overflow-hidden p-0">
            <ActionRow href="/student/badges" icon={icons.badge} title="Insignias" description="Tareas y logros" stat={`${val(badgeSummary?.earnedBadges)} obtenidas`} />
            <ActionRow href="/student/badges/requests" icon={icons.pending} title="Mis solicitudes" description="Estado de tus canjes" stat={badgeSummary?.pendingRedemptions ? `${badgeSummary.pendingRedemptions} pendientes` : ""} isLast />
          </Card>
        </div>
      </section>

      {/* ── Mi actividad: gráfico + insignias recientes ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.history}>Mi actividad</SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DashboardBarChart
            title="Páginas impresas por mes"
            data={printsByMonth}
            formatter={(v) => `${v} páginas`}
            emptyMessage="Aún no has impreso nada en los últimos 6 meses"
          />

          {/* Últimas insignias */}
          <Card className="space-y-3">
            <h3 className="font-medium text-text">Últimas insignias</h3>
            {badgeSummary && badgeSummary.recentAwards.length > 0 ? (
              <div className="space-y-2">
                {badgeSummary.recentAwards.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning">
                      {icons.badge}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text truncate">{a.prizeName}</p>
                      <p className="text-xs text-text-muted truncate">{a.subjectName}</p>
                    </div>
                    <span className="text-sm font-semibold text-warning shrink-0">+{a.badgeReward}</span>
                    <span className="text-xs text-text-muted shrink-0">
                      {formatShortDate(a.date)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <p className="text-sm text-text-muted">Aún no tienes insignias</p>
                <Link href="/student/badges" className="text-sm text-primary hover:underline">
                  Explorar tareas disponibles →
                </Link>
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* ── Historial reciente ── */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RecentActivityCard
            title="Últimos préstamos"
            items={recentLoans.map((l) => ({
              id: l.id,
              title: l.libraryItem.title,
              subtitle: "",
              status: l.status,
              date: l.requestDate,
            }))}
            emptyMessage="Aún no tienes préstamos"
          />

          <RecentActivityCard
            title="Últimos pedidos"
            items={orders.map((o) => ({
              id: o.id,
              title: o.product.name,
              subtitle: "",
              status: o.status,
              date: o.purchaseDate ?? o.createdAt ?? new Date().toISOString(),
            }))}
            emptyMessage="Aún no tienes pedidos"
          />
        </div>
      </section>
    </div>
  );
}
