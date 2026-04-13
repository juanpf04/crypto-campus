"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { SubjectForm, type SubjectFormData } from "@/components/forms";

export default function AdminEditSubjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const [initialValues, setInitialValues] = useState<Partial<SubjectFormData> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/academic/subjects/${id}`);
        if (!res.ok) throw new Error();
        const subject = await res.json();
        setInitialValues({ name: subject.name, code: subject.code });
      } catch {
        addToast("Error al cargar asignatura", "danger");
        router.push("/admin/subjects");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, addToast, router]);

  async function handleSubmit(data: SubjectFormData) {
    const res = await fetch(`/api/academic/subjects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.name }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Error al actualizar asignatura");
    }

    addToast("Asignatura actualizada", "success");
    router.push(`/admin/subjects/${id}`);
  }

  if (loading || !initialValues) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href={`/admin/subjects/${id}`} label="Volver a asignatura" />
      <h1 className="text-2xl font-bold text-text">Editar asignatura</h1>
      <Card className="max-w-2xl mx-auto p-6">
        <SubjectForm onSubmit={handleSubmit} initialValues={initialValues} isEdit />
      </Card>
    </div>
  );
}
