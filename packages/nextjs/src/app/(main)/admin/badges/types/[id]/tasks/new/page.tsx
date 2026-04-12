"use client";

/**
 * Crear tarea para un badge type (admin).
 *
 * Usa TaskForm con badgeTypeId preseleccionado.
 * POST /api/badges/tasks → redirige al detalle del badge type.
 */

import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { TaskForm, type TaskFormData } from "@/components/forms/TaskForm";

export default function AdminNewTaskPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  async function handleSubmit(data: TaskFormData) {
    const res = await fetch("/api/badges/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        rewardAmount: parseInt(data.rewardAmount),
        badgeTypeId: data.badgeTypeId,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Error al crear tarea");
    }

    addToast("Tarea creada correctamente", "success");
    router.push(`/admin/badges/types/${id}`);
  }

  return (
    <div className="space-y-6">
      <BackLink href={`/admin/badges/types/${id}`} label="Volver al tipo de insignia" />
      <h1 className="text-2xl font-bold text-text">Crear tarea</h1>
      <Card className="max-w-2xl mx-auto p-6">
        <TaskForm
          onSubmit={handleSubmit}
          initialValues={{ badgeTypeId: id }}
          badgeTypes={[{ value: id, label: "Tipo actual" }]}
        />
      </Card>
    </div>
  );
}
