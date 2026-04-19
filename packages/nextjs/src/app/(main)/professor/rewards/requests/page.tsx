"use client";

/**
 * Solicitudes de uso de recompensas (profesor).
 *
 * Muestra las solicitudes pendientes de aprobación para las recompensas
 * del profesor. Permite aprobar o rechazar cada solicitud.
 *
 * La API /api/badges/use-requests devuelve las solicitudes de uso
 * de las recompensas del profesor autenticado.
 */

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";

interface UseRequest {
  id: string;
  requestId: number;
  status: string;
  createdAt: string;
  student: { id: string; name: string; email: string };
  reward: {
    id: string;
    name: string;
    subjectBadge: { subjectOffering: { group: string; subject: { name: string; code: string } } };
  };
}

export default function ProfessorUseRequestsPage() {
  const { addToast } = useToast();

  const [requests, setRequests] = useState<UseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/badges/use-requests");
      if (res.ok) setRequests(await res.json());
    } catch {
      addToast("Error al cargar solicitudes", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleApprove(requestId: string) {
    setProcessing(requestId);
    try {
      const res = await fetch(`/api/badges/use-requests/${requestId}/approve`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al aprobar solicitud");
      }
      addToast("Solicitud aprobada", "success");
      loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al aprobar solicitud", "danger");
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(requestId: string) {
    setProcessing(requestId);
    try {
      const res = await fetch(`/api/badges/use-requests/${requestId}/reject`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al rechazar solicitud");
      }
      addToast("Solicitud rechazada", "success");
      loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al rechazar solicitud", "danger");
    } finally {
      setProcessing(null);
    }
  }

  if (loading) return <SkeletonTable columns={5} rows={6} />;

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const resolvedRequests = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-8">
      <BackLink href="/professor/rewards" label="Volver a recompensas" />
      <h1 className="text-2xl font-bold text-text">Solicitudes de uso</h1>

      {/* ── Pendientes ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.pending}>Pendientes ({pendingRequests.length})</SectionTitle>
        {pendingRequests.length === 0 ? (
          <EmptyState
            title="Sin solicitudes pendientes"
            description="No hay solicitudes de uso pendientes de aprobación."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Recompensa</TableHead>
                  <TableHead>Tipo de insignia</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{req.student.name}</p>
                        <p className="text-xs text-text-muted">{req.student.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{req.reward.name}</TableCell>
                    <TableCell className="text-text-muted">{req.reward.subjectBadge.subjectOffering.subject.code} · {req.reward.subjectBadge.subjectOffering.group}</TableCell>
                    <TableCell className="text-text-muted">
                      {new Date(req.createdAt).toLocaleDateString("es-ES")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(req.id)}
                          loading={processing === req.id}
                        >
                          Aprobar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleReject(req.id)}
                          loading={processing === req.id}
                        >
                          Rechazar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      {/* ── Resueltas ── */}
      {resolvedRequests.length > 0 && (
        <section className="space-y-4">
          <SectionTitle icon={icons.history}>Historial ({resolvedRequests.length})</SectionTitle>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Recompensa</TableHead>
                  <TableHead>Tipo de insignia</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{req.student.name}</p>
                        <p className="text-xs text-text-muted">{req.student.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{req.reward.name}</TableCell>
                    <TableCell className="text-text-muted">{req.reward.subjectBadge.subjectOffering.subject.code} · {req.reward.subjectBadge.subjectOffering.group}</TableCell>
                    <TableCell className="text-text-muted">
                      {new Date(req.createdAt).toLocaleDateString("es-ES")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={req.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      )}
    </div>
  );
}
