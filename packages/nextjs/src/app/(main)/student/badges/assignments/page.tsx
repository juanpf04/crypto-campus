"use client";

/**
 * Lista de tareas (assignments) del alumno en UNA asignatura concreta.
 * Requiere el query param `?subject=<subjectOfferingId>`.
 * Si falta, redirige a /student/badges.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { useToast } from "@/hooks/useToast";

interface EnrolledSubject {
  subjectOfferingId: string;
  subjectName: string;
  subjectCode: string;
  group: string;
  academicYear: string;
}

interface Assignment {
  id: string;
  name: string;
  description: string | null;
  status: "OPEN" | "REVIEWING" | "CLOSED";
  deadline: string | null;
  hasSubmitted: boolean;
  subjectBadge: {
    subjectOfferingId: string;
    subjectOffering: {
      group: string;
      academicYear: string;
      subject: { name: string; code: string };
    };
  };
  prizes: Array<{ id: string; name: string; description: string | null; badgeReward: number; maxWinners: number }>;
}

const STATUS_BADGE = {
  OPEN:      { label: "Abierta",     variant: "success" as const },
  REVIEWING: { label: "En revisión", variant: "warning" as const },
  CLOSED:    { label: "Cerrada",     variant: "neutral" as const },
};

export default function StudentAssignmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectParam = searchParams.get("subject");

  const { addToast } = useToast();
  const [subjects, setSubjects] = useState<EnrolledSubject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Redirige si falta el filtro
  useEffect(() => {
    if (!subjectParam) {
      router.replace("/student/badges");
    }
  }, [subjectParam, router]);

  const load = useCallback(async () => {
    try {
      const [subjectsRes, assignmentsRes] = await Promise.all([
        fetch("/api/badges/my/subjects"),
        fetch("/api/badges/my/assignments"),
      ]);
      if (subjectsRes.ok) setSubjects(await subjectsRes.json());
      if (assignmentsRes.ok) setAssignments(await assignmentsRes.json());
    } catch {
      addToast("Error al cargar tareas", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!subjectParam) return [];
    return assignments.filter((a) => a.subjectBadge.subjectOfferingId === subjectParam);
  }, [assignments, subjectParam]);

  const currentSubject = subjects.find((s) => s.subjectOfferingId === subjectParam);

  const subjectOptions = useMemo(
    () =>
      subjects.map((s) => ({
        value: s.subjectOfferingId,
        label: `${s.subjectCode} · ${s.group}`,
      })),
    [subjects],
  );

  async function handleSubmit(id: string) {
    setSubmittingId(id);
    try {
      const res = await fetch(`/api/badges/assignments/${id}/submit`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al entregar");
      addToast("Marcada como entregada", "success");
      load();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setSubmittingId(null);
    }
  }

  function handleSubjectChange(offeringId: string | null) {
    if (!offeringId) return;
    router.replace(`/student/badges/assignments?subject=${offeringId}`);
  }

  if (!subjectParam || loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href="/student/badges" label="Volver a insignias" />

      <div>
        <h1 className="text-2xl font-bold text-text">Tareas</h1>
        {currentSubject && (
          <p className="text-text-muted mt-1">
            {currentSubject.subjectName} · {currentSubject.subjectCode} · {currentSubject.group} · {currentSubject.academicYear}
          </p>
        )}
      </div>

      {subjects.length > 1 && (
        <CategoryFilter
          categories={subjectOptions}
          selected={subjectParam}
          onSelect={handleSubjectChange}
          showAll={false}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin tareas"
          description="Tu profesor aún no ha publicado tareas en esta asignatura."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((a) => {
            const status = STATUS_BADGE[a.status];
            const offering = a.subjectBadge.subjectOffering;
            return (
              <Card key={a.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">
                      {offering.subject.code} · {offering.group}
                    </p>
                    <h3 className="font-semibold text-text mt-0.5">{a.name}</h3>
                    {a.description && <p className="text-sm text-text-muted mt-1 line-clamp-2">{a.description}</p>}
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>

                <div className="text-sm">
                  <p className="font-medium text-text mb-1.5">Premios disponibles:</p>
                  <ul className="space-y-1">
                    {a.prizes.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-text-muted truncate">{p.name}</span>
                        <span className="font-medium text-primary shrink-0">
                          +{p.badgeReward} ({p.maxWinners} max)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {a.deadline && (
                  <p className="text-xs text-text-muted">
                    Fecha límite: {new Date(a.deadline).toLocaleString("es-ES")}
                  </p>
                )}

                {a.status === "OPEN" && (
                  a.hasSubmitted ? (
                    <Button variant="outline" disabled className="w-full">
                      ✓ Entregada
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSubmit(a.id)}
                      loading={submittingId === a.id}
                      className="w-full"
                    >
                      Marcar como completada
                    </Button>
                  )
                )}
                {a.status !== "OPEN" && (
                  <p className="text-xs text-text-muted text-center italic">
                    {a.hasSubmitted ? "Tu entrega fue registrada" : "No marcada como entregada"}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
