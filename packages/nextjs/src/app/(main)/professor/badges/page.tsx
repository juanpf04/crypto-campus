"use client";

/**
 * Panel principal del profesor para gestionar tareas e insignias.
 * Lista las assignments creadas con stats agregadas.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useToast } from "@/hooks/useToast";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";

interface BadgeStats {
  totalAssignments: number;
  openAssignments: number;
  reviewingAssignments: number;
  closedAssignments: number;
  totalPrizes: number;
  totalAwards: number;
  totalRewards: number;
}

interface AssignmentRow {
  id: string;
  name: string;
  status: "OPEN" | "REVIEWING" | "CLOSED";
  deadline: string | null;
  createdAt: string;
  subjectBadge: {
    subjectOffering: { group: string; academicYear: string; subject: { name: string; code: string } };
  };
  prizes: Array<{ id: string; name: string; badgeReward: number; maxWinners: number; _count: { awards: number } }>;
  _count: { submissions: number };
}

const STATUS_BADGE: Record<AssignmentRow["status"], { label: string; variant: "success" | "warning" | "neutral" }> = {
  OPEN:      { label: "Abierta",     variant: "success" },
  REVIEWING: { label: "En revisión", variant: "warning" },
  CLOSED:    { label: "Cerrada",     variant: "neutral" },
};

export default function ProfessorBadgesPage() {
  const { user, loading: authLoading } = useAuthUser();
  const { addToast } = useToast();
  const router = useRouter();

  const [stats, setStats] = useState<BadgeStats | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, assignmentsRes] = await Promise.all([
        fetch("/api/badges/stats"),
        fetch("/api/badges/assignments"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (assignmentsRes.ok) setAssignments(await assignmentsRes.json());
    } catch {
      addToast("Error al cargar datos", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  if (authLoading || loading) return <SkeletonPage />;

  return (
    <div className="space-y-8">
      <DashboardGreeting
        name={user?.name ?? "Profesor"}
        subtitle="Crea tareas con premios y otorga insignias por asignatura."
      />

      {/* ── Stats ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.badge}>Resumen</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Tareas creadas" value={stats?.totalAssignments ?? 0} subtitle="Totales" icon={icons.task} />
          <StatCard title="Abiertas" value={stats?.openAssignments ?? 0} subtitle="Aceptan entregas" icon={icons.task} />
          <StatCard title="En revisión" value={stats?.reviewingAssignments ?? 0} subtitle="Esperando premios" icon={icons.pending} />
          <StatCard title="Premios otorgados" value={stats?.totalAwards ?? 0} subtitle="A alumnos" icon={icons.student} />
        </div>
      </section>

      {/* ── Acciones rápidas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Acciones</SectionTitle>
        <div className="flex flex-wrap gap-3">
          <Link href="/professor/badges/new">
            <Button>+ Nueva tarea</Button>
          </Link>
          <Link href="/professor/rewards">
            <Button variant="outline">Recompensas</Button>
          </Link>
          <Link href="/professor/students">
            <Button variant="outline">Mis alumnos</Button>
          </Link>
        </div>
      </section>

      {/* ── Tabla de assignments ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.task}>Mis tareas</SectionTitle>
        {assignments.length === 0 ? (
          <EmptyState
            title="Sin tareas"
            description="Aún no has creado ninguna tarea. Empieza creando una."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Asignatura</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Premios</TableHead>
                  <TableHead>Entregas</TableHead>
                  <TableHead>Otorgados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => {
                  const totalAwarded = a.prizes.reduce((sum, p) => sum + p._count.awards, 0);
                  return (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/professor/badges/${a.id}`)}
                    >
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-text-muted">
                        {a.subjectBadge.subjectOffering.subject.code} · {a.subjectBadge.subjectOffering.group}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[a.status].variant}>{STATUS_BADGE[a.status].label}</Badge>
                      </TableCell>
                      <TableCell>{a.prizes.length}</TableCell>
                      <TableCell>{a._count.submissions}</TableCell>
                      <TableCell>{totalAwarded}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}
