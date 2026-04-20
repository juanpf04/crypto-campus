"use client";

/**
 * Panel de insignias del alumno.
 * Muestra una card por cada asignatura matriculada, con el conteo de insignias
 * y atajos a "Tareas" y "Recompensas" filtrados por esa asignatura.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubjectEnrollmentCard } from "@/components/shared/SubjectEnrollmentCard";
import { icons } from "@/components/ui/icons";

interface EnrolledSubject {
  subjectOfferingId: string;
  subjectBadgeId: string | null;
  subjectName: string;
  subjectCode: string;
  group: string;
  academicYear: string;
  totalBadges: number;
}

export default function StudentBadgesPage() {
  const [subjects, setSubjects] = useState<EnrolledSubject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/badges/my/subjects");
        if (res.ok && !cancelled) setSubjects(await res.json());
      } catch { /* no-op */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const totalBadges = subjects.reduce((sum, s) => sum + s.totalBadges, 0);

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-8">
      <BackLink href="/student" label="Volver al panel" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Insignias</h1>
          <p className="text-text-muted mt-1">
            {totalBadges} insignia{totalBadges !== 1 ? "s" : ""} en total
            {subjects.length > 0 && ` · ${subjects.length} asignatura${subjects.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href="/student/badges/requests">
          <Button variant="secondary">
            <span className="flex items-center gap-2">{icons.pending} Mis solicitudes</span>
          </Button>
        </Link>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          title="Sin asignaturas"
          description="Aún no estás matriculado en ninguna asignatura que participe en el sistema de insignias."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s) => (
            <SubjectEnrollmentCard
              key={s.subjectOfferingId}
              subjectOfferingId={s.subjectOfferingId}
              subjectName={s.subjectName}
              subjectCode={s.subjectCode}
              group={s.group}
              academicYear={s.academicYear}
              totalBadges={s.totalBadges}
            />
          ))}
        </div>
      )}
    </div>
  );
}
