"use client";

/**
 * SubjectExpandableRow — Organismo usado en el hub admin de asignaturas.
 *
 * Renderiza una fila de asignatura con chevron que alterna expand/collapse y,
 * al expandirse, una subtabla con los grupos (SubjectOfferings) de esa
 * asignatura con sus acciones. Combina atoms (Table, Badge, Button, icons) y
 * la navegación concreta de ese hub.
 *
 * No hace fetches: recibe los datos y callbacks desde la page.
 */

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface SubjectRowOffering {
  id: string;
  group: string;
  academicYear: string;
  professor: { id: string; name: string; email: string };
  _count: { enrollments: number };
}

export interface SubjectRowSubject {
  id: string;
  name: string;
  code: string;
  offerings: SubjectRowOffering[];
  studentsTotal: number;
}

interface SubjectExpandableRowProps {
  subject: SubjectRowSubject;
  isOpen: boolean;
  onToggle: () => void;
  /** Nº de columnas de la tabla padre (para el colSpan del contenido expandido). */
  columnCount: number;
}

export function SubjectExpandableRow({
  subject,
  isOpen,
  onToggle,
  columnCount,
}: SubjectExpandableRowProps) {
  const router = useRouter();
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell className="w-10 text-text-muted">
          <span
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center transition-transform",
              isOpen && "rotate-90",
            )}
            aria-hidden
          >
            {icons.chevronRight}
          </span>
        </TableCell>
        <TableCell className="font-mono text-sm">{subject.code}</TableCell>
        <TableCell className="font-medium">{subject.name}</TableCell>
        <TableCell>
          <Badge variant="neutral">{subject.offerings.length}</Badge>
        </TableCell>
        <TableCell>
          <Badge variant={subject.studentsTotal > 0 ? "info" : "neutral"}>
            {subject.studentsTotal}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          <div className="inline-flex gap-2" onClick={stop}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/admin/subjects/catalog/${subject.id}/edit`)}
            >
              <span className="flex items-center gap-1.5">
                {icons.pencil}
                Editar
              </span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/admin/subjects/catalog/${subject.id}/offerings/new`)}
            >
              <span className="flex items-center gap-1.5">
                {icons.plus}
                Nuevo grupo
              </span>
            </Button>
            <Button
              size="sm"
              onClick={() => router.push(`/admin/subjects/catalog/${subject.id}`)}
            >
              Abrir
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {isOpen && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={columnCount} className="bg-bg/40 p-0">
            <div className="px-4 py-3">
              {subject.offerings.length === 0 ? (
                <p className="text-sm text-text-muted italic">
                  Sin grupos creados para esta asignatura.
                </p>
              ) : (
                <Table className="bg-card">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Curso</TableHead>
                      <TableHead>Profesor</TableHead>
                      <TableHead>Alumnos</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subject.offerings.map((o) => (
                      <TableRow
                        key={o.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/admin/subjects/${o.id}`)}
                      >
                        <TableCell className="font-medium">{o.group}</TableCell>
                        <TableCell className="text-text-muted">{o.academicYear}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-text">{o.professor.name}</p>
                            <p className="text-xs text-text-muted">{o.professor.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={o._count.enrollments > 0 ? "info" : "neutral"}>
                            {o._count.enrollments}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-2" onClick={stop}>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => router.push(`/admin/subjects/${o.id}/edit`)}
                            >
                              <span className="flex items-center gap-1.5">
                                {icons.pencil}
                                Editar
                              </span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
