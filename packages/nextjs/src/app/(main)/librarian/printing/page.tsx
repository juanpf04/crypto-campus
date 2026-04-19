"use client";

/**
 * Panel de impresión del bibliotecario — Vista resumen + impresión propia.
 */

import { useEffect, useState } from "react";
import { icons } from "@/components/ui/icons";
import { useAuthUser } from "@/hooks/useAuthUser";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { StatCard } from "@/components/shared/StatCard";
import { ActionRow } from "@/components/shared/ActionRow";
import { Card } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { BackLink } from "@/components/ui/BackLink";

export default function LibrarianPrintingPage() {
  const { loading: authLoading } = useAuthUser();
  const [stats, setStats] = useState({
    activePrinters: "—" as string | number,
    totalPrinters: "—" as string | number,
    totalLogs: "—" as string | number,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/printer").then((r) => r.json()),
      fetch("/api/printer/librarian").then((r) => r.json()),
      fetch("/api/printer/logs/admin?limit=200&offset=0").then((r) => r.json()),
    ])
      .then(([activePrinters, allPrinters, logs]) => {
        setStats({
          activePrinters: Array.isArray(activePrinters) ? activePrinters.length : "—",
          totalPrinters: Array.isArray(allPrinters) ? allPrinters.length : "—",
          totalLogs: Array.isArray(logs) ? logs.length : "—",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (authLoading || loading) return <SkeletonPage />;

  return (
    <div className="space-y-10">
      <BackLink href="/librarian" label="Volver al panel" />

      <div>
        <h1 className="text-2xl font-bold text-text">Impresión</h1>
        <p className="text-text-muted mt-1">Gestión del servicio de impresión de la biblioteca</p>
      </div>

      <section className="space-y-4">
        <SectionTitle icon={icons.print}>Resumen</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Impresoras activas" value={stats.activePrinters} subtitle={`${stats.totalPrinters} registradas`} icon={icons.print} />
          <StatCard title="Impresiones totales" value={stats.totalLogs} subtitle="Registradas en el sistema" icon={icons.orders} />
          <StatCard title="Créditos ilimitados" value="Infinito" subtitle="Como bibliotecario" icon={icons.token} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Gestión</SectionTitle>
        <Card className="overflow-hidden p-0">
          <ActionRow href="/librarian/printing/printers" icon={icons.print} title="Impresoras" description="Añadir, editar y desactivar impresoras" stat={`${stats.activePrinters} activas`} />
          <ActionRow href="/librarian/printing/logs" icon={icons.orders} title="Historial de impresiones" description="Ver todas las impresiones de todos los usuarios" stat={`${stats.totalLogs} registros`} />
          <ActionRow href="/librarian/printing/print" icon={icons.file} title="Imprimir" description="Imprimir un documento" stat="" isLast />
        </Card>
      </section>
    </div>
  );
}
