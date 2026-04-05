"use client";

/**
 * Dashboard del ESTUDIANTE.
 *
 * Secciones (en el orden del sidebar):
 * - Impresión: créditos de impresión disponibles
 * - Biblioteca: tokens LIB + préstamos activos
 * - Insignias y Recompensas: insignias obtenidas, recompensas (usadas/pendientes/disponibles), tareas
 * - Tienda: tokens SHOP
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthUser } from "@/hooks/useAuthUser";
import { icons } from "@/components/ui/icons";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { CompoundCard } from "@/components/shared/CompoundCard";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { Spinner } from "@/components/ui/Spinner";
import { LinkArrow } from "@/components/shared/LinkArrow";

export default function StudentDashboard() {
  const { user, loading } = useAuthUser();

  // Datos reales de impresión
  const [printCredits, setPrintCredits] = useState<number | string>("—");
  const [printCount, setPrintCount] = useState<number | string>("—");

  // Datos reales de la biblioteca
  const [libBalance, setLibBalance] = useState<number | string>("—");
  const [activeLoans, setActiveLoans] = useState<number | string>("—");

  // Datos reales de la tienda
  const [shopBalance, setShopBalance] = useState<number | string>("—");
  const [ticketCount, setTicketCount] = useState<number | string>("—");
  const [itemCount, setItemCount] = useState<number | string>("—");

  useEffect(() => {
    if (!user) return;

    // Créditos disponibles
    fetch("/api/printer/credits")
      .then((r) => r.json())
      .then((data) => setPrintCredits(data.availableCredits ?? "—"))
      .catch(() => {});

    // Total de impresiones realizadas (pedimos con limit alto para contar)
    fetch("/api/printer/logs?limit=100&offset=0")
      .then((r) => r.json())
      .then((data) => setPrintCount(Array.isArray(data) ? data.length : "—"))
      .catch(() => {});

    // Balance de LibraryTokens
    fetch("/api/library/balance")
      .then((r) => r.json())
      .then((data) => setLibBalance(data.balance ?? "—"))
      .catch(() => {});

    // Préstamos activos del estudiante
    fetch("/api/library/loans/my")
      .then((r) => r.json())
      .then((data) => {
        const loans = Array.isArray(data) ? data : [];
        setActiveLoans(loans.filter((l: { status: string }) => l.status === "REQUESTED" || l.status === "APPROVED").length);
      })
      .catch(() => {});

    // Balance de ShopTokens
    fetch("/api/shop/balance")
      .then((r) => r.json())
      .then((data) => setShopBalance(data.balance ?? "—"))
      .catch(() => {});

    // Total de tickets y artículos
    fetch("/api/shop/batches?limit=1&offset=0")
      .then((r) => r.json())
      .then((data) => setTicketCount(data.total ?? "—"))
      .catch(() => {});

    fetch("/api/shop/orders?limit=1&offset=0")
      .then((r) => r.json())
      .then((data) => setItemCount(data.total ?? "—"))
      .catch(() => {});
  }, [user]);

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
        subtitle="Aquí tienes un resumen de tu actividad en CryptoCampus."
      />

      {/* ── Sección: Impresión ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.print}>Impresión</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/dashboard/student/printing" className="group relative block">
            <StatCard
              title="Créditos disponibles"
              value={printCredits}
              subtitle="1 crédito = 1 página"
              icon={icons.print}
              className="h-full transition-colors group-hover:border-primary/50"
            />
            <LinkArrow />
          </Link>
          <Link href="/dashboard/student/printing/history" className="group relative block">
            <StatCard
              title="Impresiones realizadas"
              value={printCount}
              subtitle="Total acumulado"
              icon={icons.orders}
              className="h-full transition-colors group-hover:border-primary/50"
            />
            <LinkArrow />
          </Link>
        </div>
      </section>

      {/* ── Sección: Biblioteca ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.library}>Biblioteca</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/dashboard/student/library" className="group relative block">
            <StatCard
              title="LibraryTokens"
              value={libBalance}
              subtitle="Balance actual"
              icon={icons.library}
              className="h-full transition-colors group-hover:border-primary/50"
            />
            <LinkArrow />
          </Link>
          <Link href="/dashboard/student/library" className="group relative block">
            <StatCard
              title="Préstamos activos"
              value={activeLoans}
              subtitle="Solicitados o en curso"
              icon={icons.loans}
              className="h-full transition-colors group-hover:border-primary/50"
            />
            <LinkArrow />
          </Link>
          <Link href="/dashboard/student/library/rooms" className="group relative block">
            <StatCard
              title="Salas de estudio"
              value=""
              subtitle="Reservar sala para hoy"
              icon={icons.rooms}
              className="h-full transition-colors group-hover:border-primary/50"
            />
            <LinkArrow />
          </Link>
        </div>
      </section>

      {/* ── Sección: Insignias y Recompensas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.badge}>Insignias y Recompensas</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Insignias obtenidas"
            value="—"
            subtitle="Total"
            icon={icons.badge}
          />

          <CompoundCard
            icon={icons.reward}
            title="Recompensas"
            slots={[
              { value: "—", label: "Usadas", color: "text-success" },
              { value: "—", label: "Pendientes", color: "text-warning" },
              { value: "—", label: "Disponibles", color: "text-primary" },
            ]}
          />

          <StatCard
            title="Tareas disponibles"
            value="—"
            subtitle="Para conseguir insignias"
            icon={icons.task}
          />
        </div>
      </section>

      {/* ── Sección: Tienda ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.shop}>Tienda</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/dashboard/student/shop" className="group relative block">
            <StatCard
              title="ShopTokens"
              value={shopBalance}
              subtitle="Balance actual"
              icon={icons.shop}
              className="h-full transition-colors group-hover:border-primary/50"
            />
            <LinkArrow />
          </Link>
          <Link href="/dashboard/student/shop/orders" className="group relative block">
            <StatCard
              title="Mis pedidos"
              value={`${ticketCount} tickets · ${itemCount} artículos`}
              subtitle="Ver historial de compras"
              icon={icons.orders}
              className="h-full transition-colors group-hover:border-primary/50"
            />
            <LinkArrow />
          </Link>
        </div>
      </section>
    </div>
  );
}
