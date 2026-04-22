"use client";

/**
 * Edición de un grupo (SubjectOffering) desde el admin.
 * Permite modificar `group` y `academicYear`. La asignatura y el profesor
 * quedan bloqueados (SubjectOfferingForm usa isEdit).
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { SubjectOfferingForm, type SubjectOfferingFormData } from "@/components/forms";

interface OfferingDetail {
  id: string;
  group: string;
  academicYear: string;
  subject: { id: string; name: string; code: string };
  professor: { id: string; name: string };
}

interface Professor {
  id: string;
  name: string;
}

export default function AdminEditOfferingPage() {
  const { offeringId } = useParams<{ offeringId: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [offering, setOffering] = useState<OfferingDetail | null>(null);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [offeringRes, professorsRes] = await Promise.all([
        fetch(`/api/academic/offerings/${offeringId}`),
        fetch("/api/academic/professors"),
      ]);
      if (!offeringRes.ok) throw new Error("Error al cargar grupo");
      const offeringData = await offeringRes.json();
      const professorsData = professorsRes.ok ? await professorsRes.json() : [];
      setOffering(offeringData);
      setProfessors(Array.isArray(professorsData) ? professorsData : professorsData.professors ?? []);
    } catch {
      addToast("Error al cargar datos", "danger");
    } finally {
      setLoading(false);
    }
  }, [offeringId, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSubmit(data: SubjectOfferingFormData) {
    const res = await fetch(`/api/academic/offerings/${offeringId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group: data.group,
        academicYear: data.academicYear,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Error al actualizar grupo");
    }

    addToast("Grupo actualizado", "success");
    router.push(`/admin/subjects/${offeringId}`);
  }

  if (loading || !offering) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href={`/admin/subjects/${offeringId}`} label="Volver al grupo" />
      <h1 className="text-2xl font-bold text-text">Editar grupo</h1>
      <Card className="max-w-2xl mx-auto p-6">
        <SubjectOfferingForm
          onSubmit={handleSubmit}
          initialValues={{
            subjectId: offering.subject.id,
            professorId: offering.professor.id,
            group: offering.group,
            academicYear: offering.academicYear,
          }}
          isEdit
          subjects={[{ value: offering.subject.id, label: `${offering.subject.code} — ${offering.subject.name}` }]}
          professors={professors.map((p) => ({ value: p.id, label: p.name }))}
        />
      </Card>
    </div>
  );
}
