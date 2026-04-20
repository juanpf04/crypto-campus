"use client";

/**
 * UseRequestsTable — Tabla de solicitudes de uso de recompensa desde la
 * perspectiva del profesor/admin. Cada fila muestra alumno, recompensa,
 * asignatura (opcional), fecha y estado. Para solicitudes PENDING muestra
 * botones "Aprobar" (primary) y "Rechazar" (danger).
 */

import { useState } from "react";
import type { RewardCategory } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/Table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RewardCategoryIcon } from "@/components/shared/RewardCategoryIcon";
import { useToast } from "@/hooks/useToast";

export interface UseRequestRow {
  id: string;
  requestId: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  createdAt: string;
  student: { id: string; name: string; email: string };
  reward: {
    id: string;
    name: string;
    category: RewardCategory;
    subjectBadge: {
      subjectOffering: {
        id: string;
        group: string;
        subject: { name: string; code: string };
      };
    };
  };
}

interface UseRequestsTableProps {
  requests: UseRequestRow[];
  /** Mostrar columna "Asignatura" (solo útil en vista global, no en filtrada). */
  showSubjectColumn?: boolean;
  /** Callback para refrescar tras aprobar/rechazar. */
  onReload: () => void;
}

export function UseRequestsTable({ requests, showSubjectColumn, onReload }: UseRequestsTableProps) {
  const { addToast } = useToast();
  const [processing, setProcessing] = useState<string | null>(null);

  async function handleAction(requestId: string, endpoint: "approve" | "reject") {
    setProcessing(requestId);
    try {
      const res = await fetch(`/api/badges/use-requests/${requestId}/${endpoint}`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error");
      }
      addToast(endpoint === "approve" ? "Solicitud aprobada" : "Solicitud rechazada", "success");
      onReload();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setProcessing(null);
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Alumno</TableHead>
            <TableHead>Recompensa</TableHead>
            {showSubjectColumn && <TableHead>Asignatura</TableHead>}
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((req) => {
            const offering = req.reward.subjectBadge.subjectOffering;
            return (
              <TableRow key={req.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-text">{req.student.name}</p>
                    <p className="text-xs text-text-muted">{req.student.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <RewardCategoryIcon category={req.reward.category} size="sm" />
                    <span className="font-medium text-text">{req.reward.name}</span>
                  </div>
                </TableCell>
                {showSubjectColumn && (
                  <TableCell>
                    <div className="text-sm">
                      <p className="text-text">{offering.subject.name}</p>
                      <p className="text-xs text-text-muted">
                        {offering.subject.code} · {offering.group}
                      </p>
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-sm text-text-muted">
                  {new Date(req.createdAt).toLocaleDateString("es-ES", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </TableCell>
                <TableCell>
                  <StatusBadge status={req.status} />
                </TableCell>
                <TableCell className="text-right">
                  {req.status === "PENDING" && (
                    <div className="inline-flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAction(req.id, "approve")}
                        loading={processing === req.id}
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleAction(req.id, "reject")}
                        disabled={processing === req.id}
                      >
                        Rechazar
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
