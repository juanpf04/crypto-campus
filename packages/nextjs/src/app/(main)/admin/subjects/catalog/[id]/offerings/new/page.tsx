"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { SubjectOfferingForm, type SubjectOfferingFormData } from "@/components/forms";

interface SubjectInfo {
  id: string;
  name: string;
  code: string;
}

interface Professor {
  id: string;
  name: string;
}

export default function AdminNewOfferingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [subject, setSubject] = useState<SubjectInfo | null>(null);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [subjectRes, professorsRes] = await Promise.all([
        fetch(`/api/academic/subjects/${id}`),
        fetch("/api/academic/professors"),
      ]);

      if (!subjectRes.ok) throw new Error("Error al cargar asignatura");
      if (!professorsRes.ok) throw new Error("Error al cargar profesores");

      const subjectData = await subjectRes.json();
      const professorsData = await professorsRes.json();

      setSubject(subjectData);
      setProfessors(Array.isArray(professorsData) ? professorsData : professorsData.professors ?? []);
    } catch {
      addToast("Error al cargar datos", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSubmit(data: SubjectOfferingFormData) {
    const res = await fetch("/api/academic/offerings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectId: data.subjectId,
        professorId: data.professorId,
        group: data.group,
        academicYear: data.academicYear,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Error al crear grupo");
    }

    addToast("Grupo creado", "success");
    router.push(`/admin/subjects/catalog/${id}`);
  }

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href={`/admin/subjects/catalog/${id}`} label="Volver a asignatura" />
      <h1 className="text-2xl font-bold text-text">Crear grupo</h1>
      <Card className="max-w-2xl mx-auto p-6">
        <SubjectOfferingForm
          onSubmit={handleSubmit}
          initialValues={{ subjectId: id }}
          subjects={subject ? [{ value: subject.id, label: `${subject.code} — ${subject.name}` }] : []}
          professors={professors.map((p) => ({ value: p.id, label: p.name }))}
        />
      </Card>
    </div>
  );
}
