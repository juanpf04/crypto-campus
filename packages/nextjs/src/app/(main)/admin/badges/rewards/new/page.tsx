"use client";

/**
 * Crear recompensa (admin).
 *
 * Carga TODOS los tipos de insignia (el admin ve todos)
 * y muestra el formulario de creación de recompensa.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { RewardForm, type RewardFormData } from "@/components/forms/RewardForm";

interface BadgeType {
  id: string;
  name: string;
  subjectOffering?: { subject: { name: string } };
}

export default function AdminNewRewardPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [badgeTypes, setBadgeTypes] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBadgeTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/badges/types");
      if (res.ok) {
        const data: BadgeType[] = await res.json();
        setBadgeTypes(
          data.map((bt) => ({
            value: bt.id,
            label: bt.subjectOffering
              ? `${bt.name} (${bt.subjectOffering.subject.name})`
              : bt.name,
          })),
        );
      }
    } catch {
      addToast("Error al cargar tipos de insignia", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadBadgeTypes(); }, [loadBadgeTypes]);

  async function handleSubmit(data: RewardFormData) {
    const res = await fetch("/api/badges/rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        badgeCost: parseInt(data.badgeCost),
        supply: parseInt(data.supply),
        badgeTypeId: data.badgeTypeId,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Error al crear recompensa");
    }

    addToast("Recompensa creada correctamente", "success");
    router.push("/admin/badges/rewards");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href="/admin/badges/rewards" label="Volver a recompensas" />
      <h1 className="text-2xl font-bold text-text">Crear recompensa</h1>
      <Card className="max-w-2xl mx-auto p-6">
        <RewardForm
          onSubmit={handleSubmit}
          badgeTypes={badgeTypes}
        />
      </Card>
    </div>
  );
}
