"use client";

/**
 * Dashboard del PROFESOR.
 * Panel docente con alertas, resumen de asignaturas/tareas/recompensas,
 * gráficos de actividad, top lists y accesos rápidos.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { icons } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { CompoundCard } from "@/components/shared/CompoundCard";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { ActionRow } from "@/components/shared/ActionRow";
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

  if (authLoading || !user) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

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
              description="Revisa y ciérralas o marca como revisando"
              actionText="Ver tareas"
              href="/professor/badges"
            />
          )}
          {s.pendingSubmissionsReview > 0 && (
            <AlertCalloutCard
              variant="info"
              icon={icons.pending}
              title={`${s.pendingSubmissionsReview} entrega${s.pendingSubmissionsReview !== 1 ? "s" : ""} pendiente${s.pendingSubmissionsReview !== 1 ? "s" : ""} de revisión`}
              description="Asigna premios o cierra las tareas en revisión"
              actionText="Ver tareas"
              href="/professor/badges"
            />
          )}
          {s.pendingRequests > 0 && (
            <AlertCalloutCard
              variant="info"
              icon={icons.reward}
              title={`${s.pendingRequests} solicitud${s.pendingRequests !== 1 ? "es" : ""} de canje pendiente${s.pendingRequests !== 1 ? "s" : ""}`}
              description="Aprueba o rechaza las solicitudes de uso de tus recompensas"
              actionText="Ver solicitudes"
              href="/professor/rewards/requests"
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
            slots={[
              { value: s?.totalRewards ?? 0, label: "Creadas", color: "text-primary" },
              { value: s?.pendingRequests ?? 0, label: "Pendientes", color: "text-warning" },
            ]}
          />
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

      {/* ── Gestión ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Gestión</SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden p-0">
            <ActionRow href="/professor/students" icon={icons.users} title="Estudiantes" description="Ver alumnos matriculados en tus asignaturas" stat={`${s?.totalEnrolledStudents ?? "—"} total`} />
            <ActionRow href="/professor/badges" icon={icons.badge} title="Insignias y tareas" description="Gestionar asignaturas, tareas y premios" stat={`${s?.totalAssignments ?? "—"} tareas`} />
            <ActionRow href="/professor/badges/new" icon={icons.task} title="Crear tarea" description="Nueva tarea con premios asociados" stat="" isLast />
          </Card>

          <Card className="overflow-hidden p-0">
            <ActionRow href="/professor/rewards" icon={icons.reward} title="Recompensas" description="Catálogo de recompensas canjeables" stat={`${s?.totalRewards ?? "—"} total`} />
            <ActionRow href="/professor/rewards/new" icon={icons.reward} title="Crear recompensa" description="Nueva recompensa para tus alumnos" stat="" />
            <ActionRow href="/professor/rewards/requests" icon={icons.pending} title="Solicitudes" description="Aprobar o rechazar canjes de recompensas" stat={s?.pendingRequests ? `${s.pendingRequests} pendientes` : ""} isLast />
          </Card>
        </div>
      </section>
    </div>
  );
}
