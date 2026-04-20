"use client";

/**
 * SubjectEnrollmentCard — Tarjeta de una asignatura matriculada por el alumno.
 * Muestra código·grupo·año, nombre, conteo de insignias y dos acciones:
 * "Tareas" y "Recompensas" que navegan filtradas por esa asignatura.
 */

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { icons } from "@/components/ui/icons";

interface SubjectEnrollmentCardProps {
  subjectOfferingId: string;
  subjectName: string;
  subjectCode: string;
  group: string;
  academicYear: string;
  totalBadges: number;
  /** Ruta base para los CTA (por defecto /student/badges). */
  baseHref?: string;
}

export function SubjectEnrollmentCard({
  subjectOfferingId,
  subjectName,
  subjectCode,
  group,
  academicYear,
  totalBadges,
  baseHref = "/student/badges",
}: SubjectEnrollmentCardProps) {
  return (
    <Card className="flex flex-col justify-between gap-4">
      <div className="space-y-1">
        <p className="text-xs font-medium text-text-muted">
          {subjectCode} · {group} · {academicYear}
        </p>
        <h3 className="text-lg font-semibold text-text">{subjectName}</h3>
      </div>

      <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {icons.badge}
        </div>
        <div>
          <p className="text-2xl font-bold text-text leading-none">{totalBadges}</p>
          <p className="text-xs text-text-muted mt-1">
            insignia{totalBadges !== 1 ? "s" : ""} en esta asignatura
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href={`${baseHref}/assignments?subject=${subjectOfferingId}`}
          className="flex-1"
        >
          <Button variant="secondary" className="w-full">
            <span className="flex items-center justify-center gap-2">
              {icons.task} Tareas
            </span>
          </Button>
        </Link>
        <Link
          href={`${baseHref}/rewards?subject=${subjectOfferingId}`}
          className="flex-1"
        >
          <Button variant="secondary" className="w-full">
            <span className="flex items-center justify-center gap-2">
              {icons.reward} Recompensas
            </span>
          </Button>
        </Link>
      </div>
    </Card>
  );
}
