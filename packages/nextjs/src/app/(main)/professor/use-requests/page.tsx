"use client";

/**
 * Vista global de solicitudes de uso (profesor): todas las solicitudes de
 * SUS recompensas, cross-subject. Filtros por asignatura y estado.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { UseRequestsTable, type UseRequestRow } from "@/components/shared/UseRequestsTable";

interface Offering {
  id: string;
  group: string;
  academicYear: string;
  subject: { name: string; code: string };
}

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendientes" },
  { value: "APPROVED", label: "Aprobadas" },
  { value: "REJECTED", label: "Rechazadas" },
  { value: "CANCELLED", label: "Canceladas" },
];

export default function ProfessorUseRequestsGlobalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectParam = searchParams.get("subject");
  const statusParam = searchParams.get("status");

  const { addToast } = useToast();
  const [requests, setRequests] = useState<UseRequestRow[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (subjectParam) params.set("subject", subjectParam);
      if (statusParam) params.set("status", statusParam);
      const qs = params.toString();

      const [reqRes, offRes] = await Promise.all([
        fetch(`/api/badges/use-requests${qs ? `?${qs}` : ""}`),
        fetch("/api/badges/subject-offerings"),
      ]);
      if (reqRes.ok) setRequests(await reqRes.json());
      if (offRes.ok) setOfferings(await offRes.json());
    } catch {
      addToast("Error al cargar solicitudes", "danger");
    } finally {
      setLoading(false);
    }
  }, [subjectParam, statusParam, addToast]);

  useEffect(() => { load(); }, [load]);

  const subjectOptions = useMemo(
    () =>
      offerings.map((o) => ({
        value: o.id,
        label: `${o.subject.code} · ${o.group}`,
      })),
    [offerings],
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
    router.replace(`/professor/use-requests${qs ? `?${qs}` : ""}`);
  }

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href="/professor" label="Volver al panel" />

      <div>
        <h1 className="text-2xl font-bold text-text">Solicitudes de uso</h1>
        <p className="text-text-muted mt-1">
          Solicitudes de uso pendientes y resueltas de tus recompensas.
        </p>
      </div>

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
              ? "No hay solicitudes que coincidan con los filtros."
              : "Aún no tienes solicitudes de uso en tus recompensas."
          }
        />
      ) : (
        <UseRequestsTable
          requests={requests}
          showSubjectColumn
          onReload={load}
        />
      )}
    </div>
  );
}
