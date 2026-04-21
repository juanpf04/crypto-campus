"use client";

/**
 * Vista global de solicitudes de uso (admin). Tabla cross-subject con filtros
 * por asignatura, profesor y estado. Reutiliza UseRequestsTable.
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
  subject: { code: string };
}

interface Professor {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendientes" },
  { value: "APPROVED", label: "Aprobadas" },
  { value: "REJECTED", label: "Rechazadas" },
  { value: "CANCELLED", label: "Canceladas" },
];

export default function AdminUseRequestsGlobalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectParam = searchParams.get("subject");
  const professorParam = searchParams.get("professor");
  const statusParam = searchParams.get("status");

  const { addToast } = useToast();
  const [requests, setRequests] = useState<UseRequestRow[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (subjectParam) params.set("subject", subjectParam);
      if (professorParam) params.set("professor", professorParam);
      if (statusParam) params.set("status", statusParam);
      const qs = params.toString();

      const [reqRes, offsRes, profsRes] = await Promise.all([
        fetch(`/api/badges/use-requests${qs ? `?${qs}` : ""}`),
        fetch("/api/badges/subject-offerings"),
        fetch("/api/badges/professors"),
      ]);
      if (reqRes.ok) setRequests(await reqRes.json());
      if (offsRes.ok) setOfferings(await offsRes.json());
      if (profsRes.ok) setProfessors(await profsRes.json());
    } catch {
      addToast("Error al cargar solicitudes", "danger");
    } finally {
      setLoading(false);
    }
  }, [subjectParam, professorParam, statusParam, addToast]);

  useEffect(() => { load(); }, [load]);

  const subjectOptions = useMemo(
    () => offerings.map((o) => ({ value: o.id, label: `${o.subject.code} · ${o.group}` })),
    [offerings],
  );
  const professorOptions = useMemo(
    () => professors.map((p) => ({ value: p.id, label: p.name })),
    [professors],
  );

  function updateQuery(next: { subject?: string | null; professor?: string | null; status?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(next)) {
      if (val === undefined) continue;
      if (val === null) params.delete(key);
      else params.set(key, val);
    }
    const qs = params.toString();
    router.replace(`/admin/use-requests${qs ? `?${qs}` : ""}`);
  }

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin" label="Volver al panel" />

      <div>
        <h1 className="text-2xl font-bold text-text">Solicitudes de uso (global)</h1>
        <p className="text-text-muted mt-1">
          Todas las solicitudes de uso de recompensas del sistema.
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

      {requests.length === 0 ? (
        <EmptyState
          title="Sin solicitudes"
          description={subjectParam || professorParam || statusParam
            ? "No hay solicitudes que coincidan con los filtros."
            : "Aún no hay solicitudes de uso en el sistema."}
        />
      ) : (
        <UseRequestsTable requests={requests} showSubjectColumn onReload={load} />
      )}
    </div>
  );
}
