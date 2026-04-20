"use client";

/**
 * Crear recompensa dentro de UNA asignatura concreta.
 * La asignatura viene en la URL; el form no muestra selector.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { RewardForm, type RewardFormData } from "@/components/forms/RewardForm";

interface OfferingInfo {
  id: string;
  subjectName: string;
  subjectCode: string;
  group: string;
  academicYear: string;
}

export default function ProfessorNewRewardInOfferingPage() {
  const params = useParams<{ offeringId: string }>();
  const offeringId = params.offeringId;
  const router = useRouter();
  const { addToast } = useToast();

  const [offering, setOffering] = useState<OfferingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOffering = useCallback(async () => {
    try {
      const res = await fetch(`/api/badges/offerings/${offeringId}/summary`);
      if (res.ok) {
        const body = await res.json();
        setOffering(body.offering);
      }
    } catch {
      addToast("Error al cargar asignatura", "danger");
    } finally {
      setLoading(false);
    }
  }, [offeringId, addToast]);

  useEffect(() => { loadOffering(); }, [loadOffering]);

  async function handleSubmit(data: RewardFormData) {
    const res = await fetch("/api/badges/rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        description: data.description || undefined,
        badgeCost: parseInt(data.badgeCost),
        supply: parseInt(data.supply),
        category: data.category,
        subjectOfferingId: data.subjectOfferingId,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Error al crear recompensa");
    }

    addToast("Recompensa creada correctamente", "success");
    router.push(`/professor/subjects/${offeringId}/rewards`);
  }

  if (loading) return <SkeletonPage />;

  const base = `/professor/subjects/${offeringId}`;

  return (
    <div className="space-y-6">
      <BackLink href={`${base}/rewards`} label="Volver a recompensas" />

      <div>
        <h1 className="text-2xl font-bold text-text">Nueva recompensa</h1>
        {offering && (
          <p className="text-text-muted mt-1">
            {offering.subjectName} · {offering.subjectCode} · {offering.group} · {offering.academicYear}
          </p>
        )}
      </div>

      <Card className="max-w-2xl p-6">
        <RewardForm
          onSubmit={handleSubmit}
          fixedOfferingId={offeringId}
        />
      </Card>
    </div>
  );
}
