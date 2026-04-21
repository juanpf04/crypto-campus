"use client";

/**
 * Tareas de una asignatura (admin).
 * Mismo comportamiento que la del profesor, con base path de admin.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
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
  deadline: string | null;
  createdAt: string;
  prizes: Array<{ id: string; _count: { awards: number } }>;
  _count: { submissions: number };
}

interface OfferingInfo {
  id: string;
  subjectName: string;
  subjectCode: string;
  group: string;
  academicYear: string;
  professor: { name: string };
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

export default function AdminOfferingAssignmentsPage() {
  const params = useParams<{ offeringId: string }>();
  const offeringId = params.offeringId;
  const router = useRouter();
  const { addToast } = useToast();

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [offering, setOffering] = useState<OfferingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Status | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assignmentsRes, summaryRes] = await Promise.all([
        fetch(`/api/badges/assignments?subject=${offeringId}`),
        fetch(`/api/badges/offerings/${offeringId}/summary`),
      ]);
      if (assignmentsRes.ok) setAssignments(await assignmentsRes.json());
      if (summaryRes.ok) {
        const body = await summaryRes.json();
        setOffering(body.offering);
      }
    } catch {
      addToast("Error al cargar tareas", "danger");
    } finally {
      setLoading(false);
    }
  }, [offeringId, addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!statusFilter) return assignments;
    return assignments.filter((a) => a.status === statusFilter);
  }, [assignments, statusFilter]);

  if (loading) return <SkeletonPage />;

  const base = `/admin/subjects/${offeringId}`;

  return (
    <div className="space-y-6">
      <BackLink href={base} label="Volver al resumen" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Tareas</h1>
          {offering && (
            <p className="text-text-muted mt-1">
              {offering.subjectName} · {offering.subjectCode} · {offering.group} · {offering.academicYear} · Prof. {offering.professor.name}
            </p>
          )}
        </div>
        <Link href={`${base}/assignments/new`}>
          <Button>+ Nueva tarea</Button>
        </Link>
      </div>

      <CategoryFilter
        categories={STATUS_OPTIONS}
        selected={statusFilter}
        onSelect={(val) => setStatusFilter(val as Status | null)}
        showAll
        allLabel="Todas"
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin tareas"
          description={
            assignments.length === 0
              ? "Aún no se ha creado ninguna tarea en esta asignatura."
              : "No hay tareas con este filtro."
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Premios</TableHead>
                <TableHead>Entregas</TableHead>
                <TableHead>Otorgados</TableHead>
                <TableHead>Creada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const status = STATUS_BADGE[a.status];
                const totalAwarded = a.prizes.reduce((sum, p) => sum + p._count.awards, 0);
                return (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`${base}/assignments/${a.id}`)}
                  >
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
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
