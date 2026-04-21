"use client";

/**
 * Vista global de tareas en REVIEWING (admin). Filtros por asignatura y
 * profesor. Cada fila lleva al detalle de la tarea dentro de su asignatura.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";

interface AssignmentRow {
  id: string;
  name: string;
  deadline: string | null;
  createdAt: string;
  subjectBadge: {
    subjectOfferingId: string;
    subjectOffering: {
      group: string;
      academicYear: string;
      subject: { name: string; code: string };
      professor: { id: string; name: string };
    };
  };
  prizes: Array<{ id: string; _count: { awards: number } }>;
  _count: { submissions: number };
}

interface Offering {
  id: string;
  group: string;
  subject: { code: string };
}

interface Professor {
  id: string;
  name: string;
}

export default function AdminPendingReviewsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectParam = searchParams.get("subject");
  const professorParam = searchParams.get("professor");

  const { addToast } = useToast();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (subjectParam) params.set("subject", subjectParam);
      if (professorParam) params.set("professor", professorParam);
      const qs = params.toString();

      const [assignmentsRes, offsRes, profsRes] = await Promise.all([
        fetch(`/api/badges/assignments/pending-review${qs ? `?${qs}` : ""}`),
        fetch("/api/badges/subject-offerings"),
        fetch("/api/badges/professors"),
      ]);
      if (assignmentsRes.ok) setAssignments(await assignmentsRes.json());
      if (offsRes.ok) setOfferings(await offsRes.json());
      if (profsRes.ok) setProfessors(await profsRes.json());
    } catch {
      addToast("Error al cargar tareas por revisar", "danger");
    } finally {
      setLoading(false);
    }
  }, [subjectParam, professorParam, addToast]);

  useEffect(() => { load(); }, [load]);

  const subjectOptions = useMemo(
    () => offerings.map((o) => ({ value: o.id, label: `${o.subject.code} · ${o.group}` })),
    [offerings],
  );
  const professorOptions = useMemo(
    () => professors.map((p) => ({ value: p.id, label: p.name })),
    [professors],
  );

  function updateQuery(next: { subject?: string | null; professor?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(next)) {
      if (val === undefined) continue;
      if (val === null) params.delete(key);
      else params.set(key, val);
    }
    const qs = params.toString();
    router.replace(`/admin/pending-reviews${qs ? `?${qs}` : ""}`);
  }

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin" label="Volver al panel" />

      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/15 text-warning">
            {icons.alert}
          </span>
          <h1 className="text-2xl font-bold text-text">Tareas por revisar</h1>
        </div>
        <p className="text-text-muted mt-1">
          Tareas del sistema en estado &quot;En revisión&quot; pendientes de otorgar premios.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">Asignatura</p>
          <CategoryFilter
            categories={subjectOptions}
            selected={subjectParam}
            onSelect={(val) => updateQuery({ subject: val })}
            showAll
            allLabel="Todas"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">Profesor</p>
          <CategoryFilter
            categories={professorOptions}
            selected={professorParam}
            onSelect={(val) => updateQuery({ professor: val })}
            showAll
            allLabel="Todos"
          />
        </div>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          title="Nada pendiente"
          description={subjectParam || professorParam
            ? "No hay tareas por revisar que coincidan con los filtros."
            : "No hay tareas en revisión en el sistema."}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarea</TableHead>
                <TableHead>Asignatura</TableHead>
                <TableHead>Profesor</TableHead>
                <TableHead>Premios</TableHead>
                <TableHead>Entregas</TableHead>
                <TableHead>Otorgados</TableHead>
                <TableHead>Creada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => {
                const totalAwarded = a.prizes.reduce((sum, p) => sum + p._count.awards, 0);
                const target = `/admin/subjects/${a.subjectBadge.subjectOfferingId}/assignments/${a.id}`;
                const offering = a.subjectBadge.subjectOffering;
                return (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => router.push(target)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{a.name}</span>
                        <Badge variant="warning">En revisión</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="text-text">{offering.subject.name}</p>
                        <p className="text-xs text-text-muted">
                          {offering.subject.code} · {offering.group} · {offering.academicYear}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-text-muted text-sm">
                      {offering.professor.name}
                    </TableCell>
                    <TableCell>{a.prizes.length}</TableCell>
                    <TableCell>{a._count.submissions}</TableCell>
                    <TableCell>{totalAwarded}</TableCell>
                    <TableCell className="text-text-muted text-xs">
                      {new Date(a.createdAt).toLocaleDateString("es-ES")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
