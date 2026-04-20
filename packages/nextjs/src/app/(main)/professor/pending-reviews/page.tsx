"use client";

/**
 * Bandeja de entrada del profesor: todas sus tareas en estado REVIEWING,
 * cross-subject. El botón del panel y el del sidebar ("Tareas por revisar")
 * llevan aquí. Clicando una fila, se navega al detalle de la tarea en su
 * asignatura correspondiente.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
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
    };
  };
  prizes: Array<{ id: string; _count: { awards: number } }>;
  _count: { submissions: number };
}

export default function PendingReviewsPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/badges/assignments/pending-review");
      if (res.ok) setAssignments(await res.json());
      else addToast("Error al cargar tareas por revisar", "danger");
    } catch {
      addToast("Error al cargar tareas por revisar", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href="/professor" label="Volver al panel" />

      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/15 text-warning">
            {icons.alert}
          </span>
          <h1 className="text-2xl font-bold text-text">Tareas por revisar</h1>
        </div>
        <p className="text-text-muted mt-1">
          Tareas en las que ya se han cerrado las entregas y pendientes de otorgar premios.
        </p>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          title="Nada pendiente"
          description="No tienes tareas en revisión ahora mismo."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarea</TableHead>
                <TableHead>Asignatura</TableHead>
                <TableHead>Premios</TableHead>
                <TableHead>Entregas</TableHead>
                <TableHead>Otorgados</TableHead>
                <TableHead>Creada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => {
                const totalAwarded = a.prizes.reduce((sum, p) => sum + p._count.awards, 0);
                const target = `/professor/subjects/${a.subjectBadge.subjectOfferingId}/assignments/${a.id}`;
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
