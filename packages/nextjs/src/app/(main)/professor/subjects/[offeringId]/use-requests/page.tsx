"use client";

/**
 * Solicitudes de uso de recompensa pertenecientes a UNA asignatura concreta.
 * Filtro por estado; sin filtro por asignatura (ya fijada en la URL).
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { UseRequestsTable, type UseRequestRow } from "@/components/shared/UseRequestsTable";

interface OfferingInfo {
  id: string;
  subjectName: string;
  subjectCode: string;
  group: string;
  academicYear: string;
}

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendientes" },
  { value: "APPROVED", label: "Aprobadas" },
  { value: "REJECTED", label: "Rechazadas" },
  { value: "CANCELLED", label: "Canceladas" },
];

export default function ProfessorOfferingUseRequestsPage() {
  const params = useParams<{ offeringId: string }>();
  const offeringId = params.offeringId;
  const searchParams = useSearchParams();
  const router = useRouter();
  const statusParam = searchParams.get("status");

  const { addToast } = useToast();
  const [requests, setRequests] = useState<UseRequestRow[]>([]);
  const [offering, setOffering] = useState<OfferingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusParam ? `&status=${statusParam}` : "";
      const [reqRes, summaryRes] = await Promise.all([
        fetch(`/api/badges/use-requests?subject=${offeringId}${qs}`),
        fetch(`/api/badges/offerings/${offeringId}/summary`),
      ]);
      if (reqRes.ok) setRequests(await reqRes.json());
      if (summaryRes.ok) {
        const body = await summaryRes.json();
        setOffering(body.offering);
      }
    } catch {
      addToast("Error al cargar solicitudes", "danger");
    } finally {
      setLoading(false);
    }
  }, [offeringId, statusParam, addToast]);

  useEffect(() => { load(); }, [load]);

  function updateStatus(next: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === null) params.delete("status");
    else params.set("status", next);
    const qs = params.toString();
    router.replace(`/professor/subjects/${offeringId}/use-requests${qs ? `?${qs}` : ""}`);
  }

  if (loading) return <SkeletonPage />;

  const base = `/professor/subjects/${offeringId}`;

  return (
    <div className="space-y-6">
      <BackLink href={base} label="Volver al resumen" />

      <div>
        <h1 className="text-2xl font-bold text-text">Solicitudes de uso</h1>
        {offering && (
          <p className="text-text-muted mt-1">
            {offering.subjectName} · {offering.subjectCode} · {offering.group} · {offering.academicYear}
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">
          Estado
        </p>
        <CategoryFilter
          categories={STATUS_OPTIONS}
          selected={statusParam}
          onSelect={updateStatus}
          showAll
          allLabel="Todas"
        />
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="Sin solicitudes"
          description={
            statusParam
              ? "No hay solicitudes con este estado."
              : "Aún no hay solicitudes de uso en esta asignatura."
          }
        />
      ) : (
        <UseRequestsTable
          requests={requests}
          showSubjectColumn={false}
          onReload={load}
        />
      )}
    </div>
  );
}
