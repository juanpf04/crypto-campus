"use client";

/**
 * Admin: lista de todas las tareas del sistema (cualquier profesor).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

interface AssignmentRow {
  id: string;
  name: string;
  status: "OPEN" | "REVIEWING" | "CLOSED";
  createdAt: string;
  creator: { name: string };
  subjectBadge: {
    subjectOffering: { group: string; subject: { code: string; name: string } };
  };
  prizes: Array<{ id: string; _count: { awards: number } }>;
  _count: { submissions: number };
}

const STATUS_BADGE = {
  OPEN:      { label: "Abierta",     variant: "success" as const },
  REVIEWING: { label: "En revisión", variant: "warning" as const },
  CLOSED:    { label: "Cerrada",     variant: "neutral" as const },
};

export default function AdminAssignmentsPage() {
  const { addToast } = useToast();
  const router = useRouter();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/badges/assignments");
        if (res.ok && !cancelled) setAssignments(await res.json());
      } catch {
        if (!cancelled) addToast("Error al cargar tareas", "danger");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [addToast]);

  if (loading) return <SkeletonTable columns={7} rows={6} />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/badges" label="Volver" />
      <h1 className="text-2xl font-bold text-text">Todas las tareas</h1>

      {assignments.length === 0 ? (
        <EmptyState title="Sin tareas" description="Aún no se ha creado ninguna tarea en el sistema." />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Profesor</TableHead>
                <TableHead>Asignatura</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Premios</TableHead>
                <TableHead>Otorgados</TableHead>
                <TableHead>Entregas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => {
                const totalAwarded = a.prizes.reduce((sum, p) => sum + p._count.awards, 0);
                const status = STATUS_BADGE[a.status];
                return (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/professor/badges/${a.id}`)}
                  >
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-text-muted">{a.creator.name}</TableCell>
                    <TableCell className="text-text-muted">
                      {a.subjectBadge.subjectOffering.subject.code} · {a.subjectBadge.subjectOffering.group}
                    </TableCell>
                    <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                    <TableCell>{a.prizes.length}</TableCell>
                    <TableCell>{totalAwarded}</TableCell>
                    <TableCell>{a._count.submissions}</TableCell>
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
