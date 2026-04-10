"use client";

/**
 * Panel de impresión del admin — Vista resumen.
 *
 * Zona superior: 3 StatCards con datos reales (impresoras, créditos, impresiones).
 * Zona inferior: Tabla de acciones rápidas con filas clicables estilizadas.
 */

import { useEffect, useState } from "react";
import { icons } from "@/components/ui/icons";
import { useAuthUser } from "@/hooks/useAuthUser";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { StatCard } from "@/components/shared/StatCard";
import { ActionRow } from "@/components/shared/ActionRow";
import { Card } from "@/components/ui/Card";
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
            href="/admin/printing/printers"
            icon={icons.print}
            title="Impresoras"
            description="Añadir, editar y desactivar impresoras"
            stat={`${stats.activePrinters} activas`}
          />
          <ActionRow
            href="/admin/printing/logs"
            icon={icons.orders}
            title="Historial de impresiones"
            description="Ver todas las impresiones de todos los usuarios"
            stat={`${stats.totalLogs} registros`}
          />
          <ActionRow
            href="/admin/printing/credits"
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
