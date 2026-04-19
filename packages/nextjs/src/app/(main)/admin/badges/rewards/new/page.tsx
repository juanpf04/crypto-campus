"use client";

/**
 * Crear recompensa (admin).
 *
 * Carga las asignaturas disponibles y muestra el formulario.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { RewardForm, type RewardFormData } from "@/components/forms/RewardForm";

interface SubjectOffering {
  id: string;
  group: string;
  academicYear: string;
  subject: { name: string; code: string };
}

export default function AdminNewRewardPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [offerings, setOfferings] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOfferings = useCallback(async () => {
    try {
      const res = await fetch("/api/badges/subject-offerings");
      if (res.ok) {
        const data: SubjectOffering[] = await res.json();
        setOfferings(
          data.map((o) => ({
            value: o.id,
            label: `${o.subject.code} · ${o.subject.name} (${o.group} · ${o.academicYear})`,
          })),
        );
      }
    } catch {
      addToast("Error al cargar asignaturas", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadOfferings(); }, [loadOfferings]);

  async function handleSubmit(data: RewardFormData) {
    const res = await fetch("/api/badges/rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        description: data.description || undefined,
        badgeCost: parseInt(data.badgeCost),
        supply: parseInt(data.supply),
        subjectOfferingId: data.subjectOfferingId,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Error al crear recompensa");
    }

    addToast("Recompensa creada correctamente", "success");
    router.push("/admin/badges/rewards");
  }

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/badges/rewards" label="Volver a recompensas" />
      <h1 className="text-2xl font-bold text-text">Crear recompensa</h1>
      <Card className="max-w-2xl mx-auto p-6">
        <RewardForm
          onSubmit={handleSubmit}
          subjectOfferings={offerings}
        />
      </Card>
    </div>
  );
}
