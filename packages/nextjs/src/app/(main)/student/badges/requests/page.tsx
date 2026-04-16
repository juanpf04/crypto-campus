"use client";

/**
 * Solicitudes de uso de recompensas del alumno.
 * Muestra solicitudes con estado y permite cancelar las pendientes.
 */

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { UseRequestCard } from "@/components/shared/UseRequestCard";
import { icons } from "@/components/ui/icons";

const STATUS_TO_NUMBER: Record<string, number> = {
  PENDING: 1, APPROVED: 2, REJECTED: 3, CANCELLED: 4,
};

interface UseRequest {
  id: string;
  requestId: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reward: {
    name: string;
    subjectBadge: { subjectOffering: { subject: { name: string; code: string }; group: string } };
  };
}

export default function StudentRequestsPage() {
  const { addToast } = useToast();
  const [requests, setRequests] = useState<UseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/badges/my/requests");
      if (res.ok) setRequests(await res.json());
    } catch { /* no-op */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleCancel(requestId: number) {
    setProcessing(requestId);
    try {
      const res = await fetch(`/api/badges/use-requests/${requestId}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast("Solicitud cancelada", "success");
      loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setProcessing(null);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-8">
      <BackLink href="/student/badges" label="Volver a insignias" />
      <h1 className="text-2xl font-bold text-text">Solicitudes de uso</h1>

      <section className="space-y-4">
        <SectionTitle icon={icons.pending}>Mis solicitudes</SectionTitle>
        {requests.length === 0 ? (
          <EmptyState title="Sin solicitudes" description="No has solicitado el uso de ninguna recompensa." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {requests.map((r) => {
              const subjectName = `${r.reward.subjectBadge.subjectOffering.subject.code} · ${r.reward.subjectBadge.subjectOffering.group}`;
              return (
                <UseRequestCard
                  key={r.id}
                  requestId={r.requestId}
                  rewardName={r.reward.name}
                  subjectName={subjectName}
                  status={STATUS_TO_NUMBER[r.status]}
                  onCancel={() => handleCancel(r.requestId)}
                  processing={processing === r.requestId}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
