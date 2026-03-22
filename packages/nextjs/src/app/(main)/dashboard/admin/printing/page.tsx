"use client";

/**
 * Panel de impresión del admin — Vista resumen.
 *
 * Muestra estadísticas rápidas (impresoras activas, total impresiones)
 * y botones de acceso a las sub-secciones de gestión.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { icons } from "@/components/ui/icons";
import { useAuthUser } from "@/hooks/useAuthUser";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

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
      fetch("/api/printer/logs/admin?limit=1").then((r) => r.json()),
      fetch("/api/printer/config").then((r) => r.json()),
    ])
      .then(([activePrinters, allPrinters, logs, config]) => {
        setStats({
          activePrinters: Array.isArray(activePrinters) ? activePrinters.length : "—",
          totalPrinters: Array.isArray(allPrinters) ? allPrinters.length : "—",
          totalLogs: Array.isArray(logs) ? "Ver historial" : "—",
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>
      </section>

      {/* ── Accesos rápidos ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Gestión</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/dashboard/admin/printing/printers">
            <div className="rounded-xl border border-border-default bg-card p-6 shadow-sm hover:border-primary/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  {icons.print}
                </div>
                <div>
                  <p className="font-medium text-text">Impresoras</p>
                  <p className="text-sm text-text-muted">Añadir, editar y desactivar</p>
                </div>
              </div>
            </div>
          </Link>
          <Link href="/dashboard/admin/printing/logs">
            <div className="rounded-xl border border-border-default bg-card p-6 shadow-sm hover:border-primary/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  {icons.orders}
                </div>
                <div>
                  <p className="font-medium text-text">Historial</p>
                  <p className="text-sm text-text-muted">Impresiones de todos los usuarios</p>
                </div>
              </div>
            </div>
          </Link>
          <Link href="/dashboard/admin/printing/credits">
            <div className="rounded-xl border border-border-default bg-card p-6 shadow-sm hover:border-primary/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  {icons.token}
                </div>
                <div>
                  <p className="font-medium text-text">Créditos</p>
                  <p className="text-sm text-text-muted">Consultar y asignar créditos</p>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
