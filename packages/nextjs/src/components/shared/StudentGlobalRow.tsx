"use client";

/**
 * StudentGlobalRow — Fila de alumno en la vista global (profesor o admin).
 * Se despliega al clicar mostrando las asignaturas del alumno. El `baseHref`
 * determina a dónde navegan los links de cada asignatura (profesor o admin).
 * En admin, cada oferta también incluye el nombre del profesor titular.
 */

import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export interface StudentGlobalOffering {
  offeringId: string;
  subjectName: string;
  subjectCode: string;
  group: string;
  academicYear: string;
  /** Solo presente en vista de admin (todas las asignaturas del alumno). */
  professorName?: string;
}

export interface StudentGlobalData {
  userId: string;
  name: string;
  email: string;
  offerings: StudentGlobalOffering[];
}

interface StudentGlobalRowProps {
  student: StudentGlobalData;
  isOpen: boolean;
  onToggle: () => void;
  /** Ruta base de cada asignatura al hacer click. Por defecto /professor/subjects */
  baseHref?: string;
  /** Texto de la cabecera del bloque expandido. */
  offeringsHeading?: string;
}

export function StudentGlobalRow({
  student,
  isOpen,
  onToggle,
  baseHref = "/professor/subjects",
  offeringsHeading = "Asignaturas que comparte contigo",
}: StudentGlobalRowProps) {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "h-4 w-4 text-text-muted transition-transform",
              isOpen && "rotate-90",
            )}
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </TableCell>
        <TableCell className="font-medium">{student.name}</TableCell>
        <TableCell className="text-text-muted">{student.email}</TableCell>
        <TableCell>
          <Badge variant={student.offerings.length > 0 ? "info" : "neutral"}>
            {student.offerings.length} asignatura{student.offerings.length !== 1 ? "s" : ""}
          </Badge>
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow className="bg-bg/50">
          <TableCell colSpan={4}>
            <div className="space-y-2 py-2 pl-6">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
                {offeringsHeading}
              </p>
              {student.offerings.length === 0 ? (
                <p className="text-sm text-text-muted italic">Sin matrículas.</p>
              ) : (
                <ul className="space-y-1">
                  {student.offerings.map((o) => (
                    <li key={o.offeringId}>
                      <Link
                        href={`${baseHref}/${o.offeringId}/students`}
                        className="flex items-center justify-between gap-3 rounded-md border border-border-default bg-card px-3 py-2 text-sm hover:border-primary/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-text truncate">{o.subjectName}</p>
                          <p className="text-xs text-text-muted">
                            {o.subjectCode} · {o.group} · {o.academicYear}
                            {o.professorName && <> · Prof. {o.professorName}</>}
                          </p>
                        </div>
                        <span className="text-xs text-primary shrink-0">Ver en asignatura →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
