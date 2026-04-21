"use client";

/**
 * Vista global de tareas (admin). Tabla cross-subject con filtros por
 * asignatura, profesor y estado. La columna "Asignatura" es clickable y
 * lleva al detalle dentro de /admin/subjects/[offeringId]/assignments.
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

type Status = "OPEN" | "REVIEWING" | "CLOSED";

interface AssignmentRow {
  id: string;
  name: string;
  status: Status;
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
  academicYear: string;
  subject: { name: string; code: string };
}

interface Professor {
  id: string;
  name: string;
}

const STATUS_BADGE: Record<Status, { label: string; variant: "success" | "warning" | "neutral" }> = {
  OPEN:      { label: "Abierta",     variant: "success" },
  REVIEWING: { label: "En revisión", variant: "warning" },
  CLOSED:    { label: "Cerrada",     variant: "neutral" },
};

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Abiertas" },
  { value: "REVIEWING", label: "En revisión" },
  { value: "CLOSED", label: "Cerradas" },
];

export default function AdminAssignmentsGlobalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectParam = searchParams.get("subject");
  const professorParam = searchParams.get("professor");
  const statusParam = searchParams.get("status");

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
        fetch(`/api/badges/assignments${qs ? `?${qs}` : ""}`),
        fetch("/api/badges/subject-offerings"),
        fetch("/api/badges/professors"),
      ]);
      if (assignmentsRes.ok) setAssignments(await assignmentsRes.json());
      if (offsRes.ok) setOfferings(await offsRes.json());
      if (profsRes.ok) setProfessors(await profsRes.json());
    } catch {
      addToast("Error al cargar tareas", "danger");
    } finally {
      setLoading(false);
    }
  }, [subjectParam, professorParam, addToast]);

  useEffect(() => { load(); }, [load]);

  const subjectOptions = useMemo(
    () => offerings.map((o) => ({
      value: o.id,
      label: `${o.subject.code} · ${o.group}`,
    })),
    [offerings],
  );

  const professorOptions = useMemo(
    () => professors.map((p) => ({ value: p.id, label: p.name })),
    [professors],
  );

  const filtered = useMemo(() => {
    if (!statusParam) return assignments;
    return assignments.filter((a) => a.status === statusParam);
  }, [assignments, statusParam]);

  function updateQuery(next: { subject?: string | null; professor?: string | null; status?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(next)) {
      if (val === undefined) continue;
      if (val === null) params.delete(key);
      else params.set(key, val);
    }
    const qs = params.toString();
    router.replace(`/admin/assignments${qs ? `?${qs}` : ""}`);
  }

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin" label="Volver al panel" />

      <div>
        <h1 className="text-2xl font-bold text-text">Tareas (global)</h1>
        <p className="text-text-muted mt-1">
          Todas las tareas del sistema. Pincha en una fila para ver el detalle en su asignatura.
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
        <div>
          <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">Estado</p>
          <CategoryFilter
            categories={STATUS_OPTIONS}
            selected={statusParam}
            onSelect={(val) => updateQuery({ status: val })}
            showAll
            allLabel="Todos"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin tareas"
          description={subjectParam || professorParam || statusParam
            ? "No hay tareas que coincidan con los filtros."
            : "Aún no hay tareas en el sistema."}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Asignatura</TableHead>
                <TableHead>Profesor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Premios</TableHead>
                <TableHead>Entregas</TableHead>
                <TableHead>Otorgados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const status = STATUS_BADGE[a.status];
                const totalAwarded = a.prizes.reduce((sum, p) => sum + p._count.awards, 0);
                const offering = a.subjectBadge.subjectOffering;
                const target = `/admin/subjects/${a.subjectBadge.subjectOfferingId}/assignments/${a.id}`;
                return (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => router.push(target)}
                  >
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="text-text">{offering.subject.name}</p>
                        <p className="text-xs text-text-muted">
                          {offering.subject.code} · {offering.group}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-text-muted text-sm">
                      {offering.professor.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
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
    </div>
  );
}
