"use client";

/**
 * Crear tarea para un tipo de insignia.
 *
 * El badgeTypeId viene del URL param [id] y se pasa
 * preseleccionado al TaskForm (no editable).
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { TaskForm, type TaskFormData } from "@/components/forms/TaskForm";

interface BadgeTypeInfo {
  id: string;
  name: string;
}

export default function ProfessorNewTaskPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [badgeType, setBadgeType] = useState<BadgeTypeInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBadgeType = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/badges/types/${id}`);
      if (res.ok) {
        const data = await res.json();
        setBadgeType({ id: data.id, name: data.name });
      }
    } catch {
      addToast("Error al cargar tipo de insignia", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => { loadBadgeType(); }, [loadBadgeType]);

  async function handleSubmit(data: TaskFormData) {
    const res = await fetch("/api/badges/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        rewardAmount: parseInt(data.rewardAmount),
        badgeTypeId: id,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Error al crear tarea");
    }

    addToast("Tarea creada correctamente", "success");
    router.push(`/professor/badges/${id}`);
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
      <BackLink href={`/professor/badges/${id}`} label="Volver al tipo de insignia" />
      <h1 className="text-2xl font-bold text-text">Crear tarea</h1>
      {badgeType && (
        <p className="text-text-muted">
          Para el tipo de insignia: <strong className="text-text">{badgeType.name}</strong>
        </p>
      )}
      <Card className="max-w-2xl mx-auto p-6">
        <TaskForm
          onSubmit={handleSubmit}
          initialValues={{ badgeTypeId: id }}
          badgeTypes={badgeType ? [{ value: badgeType.id, label: badgeType.name }] : []}
        />
      </Card>
    </div>
  );
}
