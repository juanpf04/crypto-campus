"use client";

/**
 * Lista de tareas (assignments) del alumno, agrupadas por asignatura.
 * Permite filtrar por asignatura y marcar como entregada.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { useToast } from "@/hooks/useToast";

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
  const { addToast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/badges/my/assignments");
      if (res.ok) setAssignments(await res.json());
    } catch {
      addToast("Error al cargar tareas", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  // Categorías: códigos de asignatura únicos
  const subjects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of assignments) {
      const code = a.subjectBadge.subjectOffering.subject.code;
      if (!seen.has(code)) seen.set(code, code);
    }
    return [...seen.keys()];
  }, [assignments]);

  const filtered = useMemo(() => {
    if (!selectedSubject) return assignments;
    return assignments.filter((a) => a.subjectBadge.subjectOffering.subject.code === selectedSubject);
  }, [assignments, selectedSubject]);

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

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href="/student/badges" label="Volver a insignias" />
      <h1 className="text-2xl font-bold text-text">Mis tareas</h1>

      {assignments.length === 0 ? (
        <EmptyState
          title="Sin tareas"
          description="Tus profesores aún no han publicado tareas en tus asignaturas."
        />
      ) : (
        <>
          {subjects.length > 1 && (
            <CategoryFilter
              categories={subjects}
              selected={selectedSubject}
              onSelect={setSelectedSubject}
            />
          )}

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
        </>
      )}
    </div>
  );
}
