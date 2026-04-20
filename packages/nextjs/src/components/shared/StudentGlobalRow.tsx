"use client";

/**
 * StudentGlobalRow — Fila de alumno en la vista global del profesor.
 * Se despliega al clicar mostrando las asignaturas que el profesor comparte
 * con ese alumno.
 */

import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export interface StudentGlobalData {
  userId: string;
  name: string;
  email: string;
  offerings: Array<{
    offeringId: string;
    subjectName: string;
    subjectCode: string;
    group: string;
    academicYear: string;
  }>;
}

interface StudentGlobalRowProps {
  student: StudentGlobalData;
  isOpen: boolean;
  onToggle: () => void;
}

export function StudentGlobalRow({ student, isOpen, onToggle }: StudentGlobalRowProps) {
  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={onToggle}
      >
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
                Asignaturas que comparte contigo
              </p>
              <ul className="space-y-1">
                {student.offerings.map((o) => (
                  <li key={o.offeringId}>
                    <Link
                      href={`/professor/subjects/${o.offeringId}/students`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border-default bg-card px-3 py-2 text-sm hover:border-primary/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-text truncate">{o.subjectName}</p>
                        <p className="text-xs text-text-muted">
                          {o.subjectCode} · {o.group} · {o.academicYear}
                        </p>
                      </div>
                      <span className="text-xs text-primary">Ver en asignatura →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
