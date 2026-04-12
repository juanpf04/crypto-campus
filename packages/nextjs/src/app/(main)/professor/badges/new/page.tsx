"use client";

/**
 * Crear tipo de insignia.
 *
 * Carga las asignaturas del profesor y muestra el formulario
 * de creación de badge type.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { BadgeTypeForm, type BadgeTypeFormData } from "@/components/forms/BadgeTypeForm";

interface SubjectOffering {
  id: string;
  subject: { name: string };
  academicYear: string;
}

export default function ProfessorNewBadgeTypePage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [subjectOfferings, setSubjectOfferings] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSubjectOfferings = useCallback(async () => {
    try {
      const res = await fetch("/api/badges/subject-offerings");
      if (res.ok) {
        const data: SubjectOffering[] = await res.json();
        setSubjectOfferings(
          data.map((so) => ({
            value: so.id,
            label: `${so.subject.name} (${so.academicYear})`,
          })),
        );
      }
    } catch {
      addToast("Error al cargar asignaturas", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadSubjectOfferings(); }, [loadSubjectOfferings]);

  async function handleSubmit(data: BadgeTypeFormData) {
    const res = await fetch("/api/badges/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        subjectOfferingId: data.subjectOfferingId,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Error al crear tipo de insignia");
    }

    addToast("Tipo de insignia creado correctamente", "success");
    router.push("/professor/badges");
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
      <BackLink href="/professor/badges" label="Volver a insignias" />
      <h1 className="text-2xl font-bold text-text">Crear tipo de insignia</h1>
      <Card className="max-w-2xl mx-auto p-6">
        <BadgeTypeForm
          onSubmit={handleSubmit}
          subjectOfferings={subjectOfferings}
        />
      </Card>
    </div>
  );
}
