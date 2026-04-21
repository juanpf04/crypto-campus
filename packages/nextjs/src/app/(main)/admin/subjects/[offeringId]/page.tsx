"use client";

/**
 * Resumen de una SubjectOffering desde la vista del admin.
 * Similar al resumen del profesor pero con el nombre del profesor titular
 * visible en la cabecera (info extra admin).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { icons } from "@/components/ui/icons";

interface OfferingSummary {
  offering: {
    id: string;
    group: string;
    academicYear: string;
    subjectName: string;
    subjectCode: string;
    professor: { id: string; name: string; email: string };
    hasSubjectBadge: boolean;
    enrollmentCount: number;
  };
  stats: {
    assignments: { total: number; open: number; reviewing: number; closed: number };
    awardsGiven: number;
    rewards: { total: number; active: number };
    redemptions: number;
    requests: { pending: number; approved: number };
  };
  recentAwards: Array<{
    id: string;
    awardedAt: string;
    user: { id: string; name: string };
    prizeCategory: { name: string; assignment: { name: string } };
  }>;
  recentRequests: Array<{
    id: string;
    requestId: number;
    status: string;
    createdAt: string;
    student: { id: string; name: string };
    reward: { name: string };
  }>;
}

export default function AdminOfferingSummaryPage() {
  const params = useParams<{ offeringId: string }>();
  const offeringId = params.offeringId;

  const [data, setData] = useState<OfferingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/badges/offerings/${offeringId}/summary`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Error al cargar la asignatura");
        return;
      }
      setData(body);
    } catch {
      setError("Error de red al cargar la asignatura");
    } finally {
      setLoading(false);
    }
  }, [offeringId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SkeletonPage />;
  if (error || !data) {
    return (
      <EmptyState
        title="No se pudo cargar la asignatura"
        description={error ?? "Inténtalo de nuevo más tarde."}
      />
    );
  }

  const { offering, stats, recentAwards, recentRequests } = data;
  const base = `/admin/subjects/${offering.id}`;

  return (
    <div className="space-y-8">
      <BackLink href="/admin/subjects" label="Volver a asignaturas del campus" />

      {/* Cabecera con profesor titular destacado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-text-muted">
            {offering.subjectCode} · {offering.group} · {offering.academicYear}
          </p>
          <h1 className="text-2xl font-bold text-text">{offering.subjectName}</h1>
          <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-1.5 w-fit">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
              {icons.student}
            </span>
            <div className="text-xs">
              <span className="text-text-muted">Profesor titular:</span>{" "}
              <span className="font-medium text-text">{offering.professor.name}</span>{" "}
              <span className="text-text-muted">({offering.professor.email})</span>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            {offering.enrollmentCount} alumno{offering.enrollmentCount !== 1 ? "s" : ""} matriculado{offering.enrollmentCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`${base}/assignments/new`}>
            <Button>Nueva tarea</Button>
          </Link>
          <Link href={`${base}/rewards/new`}>
            <Button variant="secondary">Nueva recompensa</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tareas"
          value={stats.assignments.total}
          subtitle={`${stats.assignments.open} abiertas · ${stats.assignments.reviewing} en revisión`}
          icon={icons.task}
        />
        <StatCard
          title="Insignias otorgadas"
          value={stats.awardsGiven}
          icon={icons.badge}
        />
        <StatCard
          title="Recompensas"
          value={stats.rewards.active}
          subtitle={`${stats.rewards.total} totales · ${stats.redemptions} canjes`}
          icon={icons.reward}
        />
        <StatCard
          title="Solicitudes"
          value={stats.requests.pending}
          subtitle={`${stats.requests.approved} aprobadas`}
          icon={icons.pending}
        />
      </div>

      {/* Actividad reciente */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <SectionTitle icon={icons.badge}>Últimas insignias otorgadas</SectionTitle>
          {recentAwards.length === 0 ? (
            <Card>
              <p className="text-sm text-text-muted italic">
                Aún no se han otorgado insignias en esta asignatura.
              </p>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <ul className="divide-y divide-border-default">
                {recentAwards.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="text-text truncate">{a.user.name}</p>
                      <p className="text-xs text-text-muted truncate">
                        {a.prizeCategory.assignment.name} — {a.prizeCategory.name}
                      </p>
                    </div>
                    <span className="text-xs text-text-muted shrink-0">
                      {new Date(a.awardedAt).toLocaleDateString("es-ES")}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        <section className="space-y-3">
          <SectionTitle icon={icons.pending}>Últimas solicitudes</SectionTitle>
          {recentRequests.length === 0 ? (
            <Card>
              <p className="text-sm text-text-muted italic">
                Aún no hay solicitudes en esta asignatura.
              </p>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <ul className="divide-y divide-border-default">
                {recentRequests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="text-text truncate">{r.student.name}</p>
                      <p className="text-xs text-text-muted truncate">{r.reward.name}</p>
                    </div>
                    <Badge
                      variant={
                        r.status === "PENDING" ? "warning" :
                        r.status === "APPROVED" ? "success" :
                        r.status === "REJECTED" ? "danger" : "neutral"
                      }
                    >
                      {r.status === "PENDING" ? "Pendiente"
                        : r.status === "APPROVED" ? "Aprobada"
                        : r.status === "REJECTED" ? "Rechazada"
                        : "Cancelada"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
