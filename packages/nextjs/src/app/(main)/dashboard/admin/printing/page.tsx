"use client";

/**
 * Panel de impresión del admin — Vista resumen.
 *
 * Zona superior: 3 StatCards con datos reales (impresoras, créditos, impresiones).
 * Zona inferior: Tabla de acciones rápidas con filas clicables estilizadas.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { icons } from "@/components/ui/icons";
import { useAuthUser } from "@/hooks/useAuthUser";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { StatCard } from "@/components/shared/StatCard";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import type { ReactNode } from "react";

/** Fila clicable de la tabla de acciones rápidas */
function ActionRow({
  href,
  icon,
  title,
  description,
  stat,
  isLast,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  stat: string | number;
  isLast?: boolean;
}) {
  return (
    <Link href={href} className="group">
      <div
        className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-primary/5 ${
          !isLast ? "border-b border-border-default" : ""
        }`}
      >
        {/* Icono */}
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
          {icon}
        </div>

        {/* Título + descripción */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text">{title}</p>
          <p className="text-sm text-text-muted">{description}</p>
        </div>

        {/* Stat rápido */}
        <span className="text-sm font-medium text-text-muted shrink-0">
          {stat}
        </span>

        {/* Flecha ↗ */}
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

export default function AdminPrintingPage() {
  const { user, loading: authLoading } = useAuthUser();
  const [stats, setStats] = useState({
    activePrinters: "—" as string | number,
    totalPrinters: "—" as string | number,
    totalLogs: "—" as string | number,
    initialCredits: "—" as string | number,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/printer").then((r) => r.json()),
      fetch("/api/printer/admin").then((r) => r.json()),
      fetch("/api/printer/logs/admin?limit=200&offset=0").then((r) => r.json()),
      fetch("/api/printer/config").then((r) => r.json()),
    ])
      .then(([activePrinters, allPrinters, logs, config]) => {
        setStats({
          activePrinters: Array.isArray(activePrinters) ? activePrinters.length : "—",
          totalPrinters: Array.isArray(allPrinters) ? allPrinters.length : "—",
          totalLogs: Array.isArray(logs) ? logs.length : "—",
          initialCredits: config.initialCredits ?? "—",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <DashboardGreeting
        name={user?.name ?? "Admin"}
        subtitle="Gestión del servicio de impresión"
      />

      {/* ── Estadísticas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.print}>Resumen</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Impresoras activas"
            value={stats.activePrinters}
            subtitle={`${stats.totalPrinters} registradas en total`}
            icon={icons.print}
          />
          <StatCard
            title="Créditos iniciales"
            value={stats.initialCredits}
            subtitle="Por estudiante registrado"
            icon={icons.token}
          />
          <StatCard
            title="Impresiones totales"
            value={stats.totalLogs}
            subtitle="Registradas en el sistema"
            icon={icons.orders}
          />
        </div>
      </section>

      {/* ── Acciones rápidas — tabla estilizada ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Gestión</SectionTitle>
        <Card className="overflow-hidden p-0">
          <ActionRow
            href="/dashboard/admin/printing/printers"
            icon={icons.print}
            title="Impresoras"
            description="Añadir, editar y desactivar impresoras"
            stat={`${stats.activePrinters} activas`}
          />
          <ActionRow
            href="/dashboard/admin/printing/logs"
            icon={icons.orders}
            title="Historial de impresiones"
            description="Ver todas las impresiones de todos los usuarios"
            stat={`${stats.totalLogs} registros`}
          />
          <ActionRow
            href="/dashboard/admin/printing/credits"
            icon={icons.token}
            title="Créditos de estudiantes"
            description="Consultar y asignar créditos de impresión"
            stat={`${stats.initialCredits} iniciales`}
            isLast
          />
        </Card>
      </section>
    </div>
  );
}
