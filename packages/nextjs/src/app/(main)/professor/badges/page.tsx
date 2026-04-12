"use client";

/**
 * Panel de insignias del profesor.
 *
 * Muestra estadísticas globales (tipos, tareas, otorgamientos),
 * acciones rápidas y la tabla completa de badge types creados.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useToast } from "@/hooks/useToast";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { ActionRow } from "@/components/shared/ActionRow";
import { Spinner } from "@/components/ui/Spinner";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";

interface BadgeStats {
  badgeTypes: number;
  tasks: number;
  awards: number;
}

interface BadgeType {
  id: string;
  name: string;
  subjectOffering: {
    subject: { name: string };
  };
  _count: { tasks: number; awards: number };
}

export default function ProfessorBadgesPage() {
  const { user, loading: authLoading } = useAuthUser();
  const { addToast } = useToast();
  const router = useRouter();

  const [stats, setStats] = useState<BadgeStats>({ badgeTypes: 0, tasks: 0, awards: 0 });
  const [badgeTypes, setBadgeTypes] = useState<BadgeType[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, typesRes] = await Promise.all([
        fetch("/api/badges/stats"),
        fetch("/api/badges/types"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (typesRes.ok) setBadgeTypes(await typesRes.json());
    } catch {
      addToast("Error al cargar datos de insignias", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  if ((authLoading || loading) && badgeTypes.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardGreeting
        name={user?.name ?? "Profesor"}
        subtitle="Panel de gestión de insignias."
      />

      {/* ── Estadísticas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.badge}>Resumen</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Tipos de insignia"
            value={stats.badgeTypes}
            subtitle="Definidos por ti"
            icon={icons.badge}
          />
          <StatCard
            title="Tareas"
            value={stats.tasks}
            subtitle="Creadas"
            icon={icons.task}
          />
          <StatCard
            title="Insignias otorgadas"
            value={stats.awards}
            subtitle="A alumnos"
            icon={icons.student}
          />
        </div>
      </section>

      {/* ── Acciones rápidas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Acciones</SectionTitle>
        <Card className="overflow-hidden p-0">
          <ActionRow
            href="/professor/badges/new"
            icon={icons.badge}
            title="Crear tipo de insignia"
            description="Define un nuevo tipo de insignia para una asignatura"
            stat=""
          />
          <ActionRow
            href="/professor/rewards"
            icon={icons.reward}
            title="Recompensas"
            description="Gestiona las recompensas canjeables"
            stat=""
          />
          <ActionRow
            href="/professor/students"
            icon={icons.student}
            title="Mis alumnos"
            description="Consulta el progreso de tus alumnos"
            stat=""
            isLast
          />
        </Card>
      </section>

      {/* ── Tabla de tipos de insignia ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.badge}>Mis tipos de insignia</SectionTitle>
        {badgeTypes.length === 0 ? (
          <EmptyState
            title="Sin tipos de insignia"
            description="Aún no has creado ningún tipo de insignia. Empieza creando uno."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Asignatura</TableHead>
                  <TableHead>Tareas</TableHead>
                  <TableHead>Otorgamientos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {badgeTypes.map((bt) => (
                  <TableRow
                    key={bt.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/professor/badges/${bt.id}`)}
                  >
                    <TableCell className="font-medium">{bt.name}</TableCell>
                    <TableCell className="text-text-muted">
                      {bt.subjectOffering?.subject?.name ?? "—"}
                    </TableCell>
                    <TableCell>{bt._count.tasks}</TableCell>
                    <TableCell>{bt._count.awards}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}
