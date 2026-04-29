"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { SubjectForm, type SubjectFormData } from "@/components/forms";

export default function AdminNewSubjectPage() {
  const router = useRouter();
  const { addToast } = useToast();

  async function handleSubmit(data: SubjectFormData) {
    const res = await fetch("/api/academic/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.name, code: data.code }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Error al crear asignatura");
    }

    addToast("Asignatura creada", "success");
    router.push("/admin/subjects/catalog");
  }

  return (
    <div className="space-y-6">
      <BackLink href="/admin/subjects/catalog" label="Volver al catálogo" />
      <h1 className="text-2xl font-bold text-text">Crear asignatura</h1>
      <Card className="max-w-2xl mx-auto p-6">
        <SubjectForm onSubmit={handleSubmit} />
      </Card>
    </div>
  );
}
