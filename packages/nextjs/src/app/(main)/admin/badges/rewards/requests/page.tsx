"use client";

/**
 * Solicitudes de uso de recompensas — vista admin (todas las solicitudes del sistema).
 */

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { icons } from "@/components/ui/icons";

interface UseRequest {
  id: string;
  requestId: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  student: { id: string; name: string; email: string };
  reward: {
    id: string;
    name: string;
    subjectBadge: { subjectOffering: { subject: { name: string; code: string }; group: string } };
  };
}

export default function AdminUseRequestsPage() {
  const { addToast } = useToast();
  const [requests, setRequests] = useState<UseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/badges/use-requests");
      if (res.ok) setRequests(await res.json());
    } catch { /* no-op */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleAction(requestId: number, action: "approve" | "reject") {
    setProcessing(requestId);
    try {
      const res = await fetch(`/api/badges/use-requests/${requestId}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast(action === "approve" ? "Solicitud aprobada" : "Solicitud rechazada", "success");
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
      <BackLink href="/admin/badges" label="Volver a insignias" />
      <h1 className="text-2xl font-bold text-text">Solicitudes de uso</h1>

      <section className="space-y-4">
        <SectionTitle icon={icons.pending}>Solicitudes</SectionTitle>
        {requests.length === 0 ? (
          <EmptyState title="Sin solicitudes" description="No hay solicitudes de uso de recompensas en el sistema." />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-border-default">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-text">{r.reward.name}</p>
                    <p className="text-xs text-text-muted">
                      {r.reward.subjectBadge.subjectOffering.subject.code} · {r.reward.subjectBadge.subjectOffering.group} — {r.student.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    {r.status === "PENDING" && (
                      <>
                        <Button size="sm" onClick={() => handleAction(r.requestId, "approve")} loading={processing === r.requestId}>
                          Aprobar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleAction(r.requestId, "reject")} disabled={processing === r.requestId}>
                          Rechazar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
