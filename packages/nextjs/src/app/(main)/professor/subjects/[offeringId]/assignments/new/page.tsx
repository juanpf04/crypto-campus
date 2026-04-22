"use client";

/**
 * Crear nueva tarea dentro de UNA asignatura concreta.
 * La asignatura viene en la URL — no hay selector.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { AssignmentForm, type AssignmentFormData } from "@/components/forms";

interface OfferingInfo {
  id: string;
  subjectName: string;
  subjectCode: string;
  group: string;
  academicYear: string;
}

export default function NewAssignmentPage() {
  const params = useParams<{ offeringId: string }>();
  const offeringId = params.offeringId;
  const router = useRouter();
  const { addToast } = useToast();

  const [offering, setOffering] = useState<OfferingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/badges/offerings/${offeringId}/summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body) setOffering(body.offering);
      })
      .catch(() => addToast("Error al cargar asignatura", "danger"))
      .finally(() => setLoading(false));
  }, [offeringId, addToast]);

  async function handleSubmit(data: AssignmentFormData) {
    try {
      const res = await fetch("/api/badges/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectOfferingId: offeringId,
          ...data,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al crear tarea");

      addToast("Tarea creada correctamente", "success");
      router.push(`/professor/subjects/${offeringId}/assignments/${body.assignment.id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al crear tarea", "danger");
    }
  }

  if (loading) return <SkeletonPage />;

  const base = `/professor/subjects/${offeringId}`;

  return (
    <div className="space-y-6">
      <BackLink href={`${base}/assignments`} label="Volver a tareas" />

      <div>
        <h1 className="text-2xl font-bold text-text">Nueva tarea</h1>
        {offering && (
          <p className="text-text-muted mt-1">
            {offering.subjectName} · {offering.subjectCode} · {offering.group} · {offering.academicYear}
          </p>
        )}
      </div>

      <AssignmentForm onSubmit={handleSubmit} onCancel={() => router.back()} />
    </div>
  );
}
