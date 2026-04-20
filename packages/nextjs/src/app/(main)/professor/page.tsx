"use client";

/**
 * Dashboard del PROFESOR.
 * Panel docente con alertas, resumen de asignaturas/tareas/recompensas,
 * gráficos de actividad, top lists y actividad reciente.
 *
 * Las acciones de crear tareas/recompensas y gestionar alumnos/solicitudes
 * son CONTEXTUALES por asignatura; se acceden desde el sidebar (subsecciones
 * de cada asignatura) o desde los accesos generales del sidebar.
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
import { AlertCalloutCard } from "@/components/shared/AlertCalloutCard";
import { DashboardBarChart } from "@/components/shared/DashboardBarChart";
import { TopListCard } from "@/components/shared/TopListCard";
import { RecentActivityCard } from "@/components/shared/RecentActivityCard";

// ── Tipos ─────────────────────────────────────────────────────────────────

interface ProfessorStats {
  totalSubjectBadges: number;
  totalAssignments: number;
  openAssignments: number;
  reviewingAssignments: number;
  closedAssignments: number;
  totalAwards: number;
  totalRewards: number;
  pendingRequests: number;
  totalEnrolledStudents: number;

  overdueAssignments: number;
  pendingSubmissionsReview: number;

  assignmentsByMonth: { month: string; count: number }[];
  awardsByMonth: { month: string; count: number }[];

  topSubjectsByEnrollment: { subjectName: string; group: string; enrollmentCount: number }[];
  topAssignmentsBySubmissions: { assignmentName: string; subjectName: string; submissionCount: number; status: string }[];

  recentAwards: { studentName: string; prizeName: string; assignmentName: string; date: string }[];
  recentUseRequests: { studentName: string; rewardName: string; status: string; date: string }[];
}

// ── Componente ────────────────────────────────────────────────────────────

export default function ProfessorDashboard() {
  const { user, loading: authLoading } = useAuthUser();
  const [stats, setStats] = useState<ProfessorStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/professor/stats");
      if (res.ok) setStats(await res.json());
    } catch {
      // Stats no críticas
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (authLoading || !user) return <SkeletonPage />;

  const s = stats;
  const val = (v: number | undefined) => loading ? "—" : String(v ?? 0);

  return (
    <div className="space-y-10">
      <DashboardGreeting name={user.name} subtitle="Tu panel docente." />

      {/* ── Alertas contextuales ── */}
      {s && (s.overdueAssignments > 0 || s.pendingSubmissionsReview > 0 || s.pendingRequests > 0) && (
        <div className="space-y-3">
          {s.overdueAssignments > 0 && (
            <AlertCalloutCard
              variant="warning"
              icon={icons.alert}
              title={`${s.overdueAssignments} tarea${s.overdueAssignments !== 1 ? "s" : ""} con plazo vencido`}
              description="Ciérralas para revisión y otorga los premios"
              actionText="Ver tareas por revisar"
              href="/professor/pending-reviews"
            />
          )}
          {s.pendingSubmissionsReview > 0 && (
            <AlertCalloutCard
              variant="info"
              icon={icons.pending}
              title={`${s.pendingSubmissionsReview} entrega${s.pendingSubmissionsReview !== 1 ? "s" : ""} pendiente${s.pendingSubmissionsReview !== 1 ? "s" : ""} de revisión`}
              description="Asigna premios o cierra las tareas en revisión"
              actionText="Ver tareas por revisar"
              href="/professor/pending-reviews"
            />
          )}
          {s.pendingRequests > 0 && (
            <AlertCalloutCard
              variant="info"
              icon={icons.reward}
              title={`${s.pendingRequests} solicitud${s.pendingRequests !== 1 ? "es" : ""} de canje pendiente${s.pendingRequests !== 1 ? "s" : ""}`}
              description="Aprueba o rechaza las solicitudes de uso de tus recompensas"
              actionText="Ver solicitudes"
              href="/professor/use-requests?status=PENDING"
            />
          )}
        </div>
      )}

      {/* ── Resumen ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.badge}>Resumen</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Asignaturas"
            value={val(s?.totalSubjectBadges)}
            subtitle={`${s?.totalEnrolledStudents ?? 0} estudiantes matriculados`}
            icon={icons.library}
          />
          <CompoundCard
            icon={icons.task}
            title="Tareas por estado"
            className="sm:col-span-2"
            slots={[
              { value: s?.openAssignments ?? 0, label: "Abiertas", color: "text-primary" },
              { value: s?.reviewingAssignments ?? 0, label: "En revisión", color: "text-warning" },
              { value: s?.closedAssignments ?? 0, label: "Cerradas", color: "text-text-muted" },
            ]}
          />
          <StatCard
            title="Insignias otorgadas"
            value={val(s?.totalAwards)}
            subtitle="Total a tus alumnos"
            icon={icons.badge}
          />
          <CompoundCard
            icon={icons.reward}
            title="Recompensas"
            className="sm:col-span-2"
            slots={[
              { value: s?.totalRewards ?? 0, label: "Creadas", color: "text-primary" },
              { value: s?.pendingRequests ?? 0, label: "Solicitudes", color: "text-warning" },
            ]}
          />

          {/* Card clickable destacada — acceso directo a la bandeja de tareas a revisar */}
          <Link
            href="/professor/pending-reviews"
            className="sm:col-span-2 group"
          >
            <Card className="flex items-center gap-4 h-full transition-colors hover:border-primary/40">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning">
                {icons.alert}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-muted">Tareas por revisar</p>
                <p className="text-2xl font-bold text-text">
                  {val(s?.reviewingAssignments)}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Entregas cerradas a la espera de que otorgues premios
                </p>
              </div>
              <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                Ver →
              </span>
            </Card>
          </Link>
        </div>
      </section>

      {/* ── Gráficos de actividad ── */}
      {s && (
        <section className="space-y-4">
          <SectionTitle icon={icons.history}>Mi actividad</SectionTitle>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DashboardBarChart
              title="Tareas creadas por mes"
              data={s.assignmentsByMonth}
              emptyMessage="No has creado tareas en los últimos 6 meses"
              formatter={(v) => `${v} tarea${v !== 1 ? "s" : ""}`}
            />
            <DashboardBarChart
              title="Insignias otorgadas por mes"
              data={s.awardsByMonth}
              emptyMessage="No has otorgado insignias en los últimos 6 meses"
              formatter={(v) => `${v} insignia${v !== 1 ? "s" : ""}`}
            />
          </div>
        </section>
      )}

      {/* ── Top lists ── */}
      {s && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TopListCard
              title="Top asignaturas por matrícula"
              items={s.topSubjectsByEnrollment.map((x) => ({
                title: x.subjectName,
                subtitle: `Grupo ${x.group}`,
                stat: x.enrollmentCount,
              }))}
              emptyMessage="No tienes asignaturas asignadas"
            />
            <TopListCard
              title="Top tareas por entregas"
              items={s.topAssignmentsBySubmissions.map((x) => ({
                title: x.assignmentName,
                subtitle: x.subjectName,
                stat: x.submissionCount,
              }))}
              emptyMessage="Aún no hay entregas"
            />
          </div>
        </section>
      )}

      {/* ── Actividad reciente ── */}
      {s && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RecentActivityCard
              title="Últimas insignias otorgadas"
              items={s.recentAwards.map((a, i) => ({
                id: `${a.prizeName}-${i}`,
                title: a.studentName,
                subtitle: `${a.prizeName} · ${a.assignmentName}`,
                date: a.date,
              }))}
              emptyMessage="No has otorgado insignias aún"
              showStatus={false}
            />
            <RecentActivityCard
              title="Últimas solicitudes de uso"
              items={s.recentUseRequests.map((r, i) => ({
                id: `${r.rewardName}-${i}`,
                title: r.studentName,
                subtitle: r.rewardName,
                status: r.status,
                date: r.date,
              }))}
              emptyMessage="No hay solicitudes de uso"
            />
          </div>
        </section>
      )}
    </div>
  );
}
