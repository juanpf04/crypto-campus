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

export default function StudentDashboard() {
  const { user, loading } = useAuthUser();

  // Datos reales de impresión
  const [printCredits, setPrintCredits] = useState<number | string>("—");
  const [printCount, setPrintCount] = useState<number | string>("—");

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
            <div className="pointer-events-none absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
              {icons.externalArrow}
            </div>
          </Link>
          <Link href="/dashboard/student/printing/history" className="group relative block">
            <StatCard
              title="Impresiones realizadas"
              value={printCount}
              subtitle="Total acumulado"
              icon={icons.orders}
              className="h-full transition-colors group-hover:border-primary/50"
            />
            <div className="pointer-events-none absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
              {icons.externalArrow}
            </div>
          </Link>
        </div>
      </section>

      {/* ── Sección: Biblioteca ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.library}>Biblioteca</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Tokens LIB"
            value="—"
            subtitle="Balance actual"
            icon={icons.library}
          />
          <StatCard
            title="Préstamos activos"
            value="—"
            subtitle="En curso"
            icon={icons.loans}
          />
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
          <StatCard
            title="Tokens SHOP"
            value="—"
            subtitle="Balance actual"
            icon={icons.shop}
          />
        </div>
      </section>
    </div>
  );
}
