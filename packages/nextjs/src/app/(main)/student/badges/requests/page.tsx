"use client";

/**
 * Mis solicitudes de uso de recompensas.
 * Tabla con filtros por asignatura y estado. Lee `?subject` y `?status` del query.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";

interface EnrolledSubject {
  subjectOfferingId: string;
  subjectName: string;
  subjectCode: string;
  group: string;
}

type Status = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

interface UseRequest {
  id: string;
  requestId: number;
  status: Status;
  createdAt: string;
  reward: {
    name: string;
    subjectBadge: {
      subjectOffering: {
        id: string;
        subject: { name: string; code: string };
        group: string;
      };
    };
  };
}

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendientes" },
  { value: "APPROVED", label: "Aprobadas" },
  { value: "REJECTED", label: "Rechazadas" },
  { value: "CANCELLED", label: "Canceladas" },
];

export default function StudentRequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectParam = searchParams.get("subject");
  const statusParam = searchParams.get("status") as Status | null;

  const { addToast } = useToast();
  const [subjects, setSubjects] = useState<EnrolledSubject[]>([]);
  const [requests, setRequests] = useState<UseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (subjectParam) params.set("subject", subjectParam);
      if (statusParam) params.set("status", statusParam);
      const qs = params.toString();

      const [subjectsRes, requestsRes] = await Promise.all([
        fetch("/api/badges/my/subjects"),
        fetch(`/api/badges/my/requests${qs ? `?${qs}` : ""}`),
      ]);
      if (subjectsRes.ok) setSubjects(await subjectsRes.json());
      if (requestsRes.ok) setRequests(await requestsRes.json());
    } catch {
      addToast("Error al cargar solicitudes", "danger");
    } finally {
      setLoading(false);
    }
  }, [subjectParam, statusParam, addToast]);

  useEffect(() => { load(); }, [load]);

  const subjectOptions = useMemo(
    () =>
      subjects.map((s) => ({
        value: s.subjectOfferingId,
        label: `${s.subjectCode} · ${s.group}`,
      })),
    [subjects],
  );

  function updateQuery(next: { subject?: string | null; status?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.subject !== undefined) {
      if (next.subject === null) params.delete("subject");
      else params.set("subject", next.subject);
    }
    if (next.status !== undefined) {
      if (next.status === null) params.delete("status");
      else params.set("status", next.status);
    }
    const qs = params.toString();
    router.replace(`/student/badges/requests${qs ? `?${qs}` : ""}`);
  }

  const [pendingCancel, setPendingCancel] = useState<number | null>(null);

  async function handleCancel(requestId: number) {
    setProcessing(requestId);
    try {
      const res = await fetch(`/api/badges/use-requests/${requestId}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast("Solicitud cancelada", "success");
      load();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setProcessing(null);
    }
  }

  async function confirmCancel() {
    if (pendingCancel === null) return;
    const id = pendingCancel;
    setPendingCancel(null);
    await handleCancel(id);
  }

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink
        href={subjectParam ? `/student/badges/rewards?subject=${subjectParam}` : "/student/badges"}
        label={subjectParam ? "Volver a recompensas" : "Volver a insignias"}
      />

      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            {icons.pending}
          </span>
          <h1 className="text-2xl font-bold text-text">Mis solicitudes</h1>
        </div>
        <p className="text-text-muted mt-1">
          Historial de solicitudes de uso de tus recompensas
        </p>
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">
            Asignatura
          </p>
          <CategoryFilter
            categories={subjectOptions}
            selected={subjectParam}
            onSelect={(val) => updateQuery({ subject: val })}
            showAll
            allLabel="Todas"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">
            Estado
          </p>
          <CategoryFilter
            categories={STATUS_OPTIONS}
            selected={statusParam}
            onSelect={(val) => updateQuery({ status: val })}
            showAll
            allLabel="Todos"
          />
        </div>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="Sin solicitudes"
          description={
            subjectParam || statusParam
              ? "No hay solicitudes que coincidan con los filtros seleccionados."
              : "Aún no has solicitado el uso de ninguna recompensa."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recompensa</TableHead>
              <TableHead>Asignatura</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => {
              const offering = r.reward.subjectBadge.subjectOffering;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-text">{r.reward.name}</p>
                      <p className="text-xs text-text-muted">#{r.requestId}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p className="text-text">{offering.subject.name}</p>
                      <p className="text-xs text-text-muted">
                        {offering.subject.code} · {offering.group}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-text-muted">
                    {new Date(r.createdAt).toLocaleDateString("es-ES", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setPendingCancel(r.requestId)}
                        loading={processing === r.requestId}
                      >
                        Cancelar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <ConfirmModal
        open={pendingCancel !== null}
        onClose={() => { if (processing === null) setPendingCancel(null); }}
        onConfirm={confirmCancel}
        title="Cancelar solicitud"
        description="La solicitud será cancelada on-chain y no podrá recuperarse. ¿Quieres continuar?"
        confirmLabel="Cancelar solicitud"
        loading={processing === pendingCancel}
      />
    </div>
  );
}
