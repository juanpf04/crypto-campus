"use client";

/**
 * Crear tarea (admin) dentro de una asignatura concreta.
 * Comparte el mismo formulario con la vista del profesor.
 */

import { useCallback, useEffect, useState } from "react";
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
  professor: { name: string };
}

export default function AdminNewAssignmentPage() {
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
      router.push(`/admin/subjects/${offeringId}/assignments/${body.assignment.id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al crear tarea", "danger");
    }
  }

  if (loading) return <SkeletonPage />;

  const base = `/admin/subjects/${offeringId}`;

  return (
    <div className="space-y-6">
      <BackLink href={`${base}/assignments`} label="Volver a tareas" />

      <div>
        <h1 className="text-2xl font-bold text-text">Nueva tarea</h1>
        {offering && (
          <p className="text-text-muted mt-1">
            {offering.subjectName} · {offering.subjectCode} · {offering.group} · {offering.academicYear} · Prof. {offering.professor.name}
          </p>
        )}
      </div>

      <AssignmentForm onSubmit={handleSubmit} onCancel={() => router.back()} />
    </div>
  );
}
