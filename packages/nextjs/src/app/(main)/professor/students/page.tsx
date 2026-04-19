"use client";

/**
 * Vista de alumnos del profesor.
 *
 * Permite seleccionar una asignatura y ver la lista de alumnos
 * matriculados con sus insignias ganadas, tareas completadas
 * y recompensas canjeadas.
 */

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";
import { TaskCompletionIndicator } from "@/components/shared/TaskCompletionIndicator";

interface SubjectOffering {
  id: string;
  subject: { name: string };
  academicYear: string;
}

interface StudentTask {
  taskId: string;
  taskName: string;
  completed: boolean;
}

interface StudentRedemption {
  rewardName: string;
}

interface StudentData {
  id: string;
  name: string;
  email: string;
  badgeCount: number;
  tasks: StudentTask[];
  redemptions: StudentRedemption[];
}

export default function ProfessorStudentsPage() {
  const { addToast } = useToast();

  const [subjectOfferings, setSubjectOfferings] = useState<SubjectOffering[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [search, setSearch] = useState("");

  const loadSubjectOfferings = useCallback(async () => {
    try {
      const res = await fetch("/api/badges/subject-offerings");
      if (res.ok) {
        const data: SubjectOffering[] = await res.json();
        setSubjectOfferings(data);
        if (data.length > 0) {
          setSelectedSubjectId(data[0].id);
        }
      }
    } catch {
      addToast("Error al cargar asignaturas", "danger");
    } finally {
      setLoadingSubjects(false);
    }
  }, [addToast]);

  useEffect(() => { loadSubjectOfferings(); }, [loadSubjectOfferings]);

  const loadStudents = useCallback(async () => {
    if (!selectedSubjectId) return;
    setLoadingStudents(true);
    try {
      const res = await fetch(`/api/badges/students/${selectedSubjectId}`);
      if (res.ok) setStudents(await res.json());
    } catch {
      addToast("Error al cargar alumnos", "danger");
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedSubjectId, addToast]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const filteredStudents = students.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  if (loadingSubjects) return <SkeletonTable columns={5} rows={3} />;

  return (
    <div className="space-y-8">
      <BackLink href="/professor" label="Volver al panel" />
      <h1 className="text-2xl font-bold text-text">Mis alumnos</h1>

      {/* ── Selector de asignatura ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Asignatura</SectionTitle>
        {subjectOfferings.length === 0 ? (
          <EmptyState
            title="Sin asignaturas"
            description="No tienes asignaturas asignadas."
          />
        ) : (
          <div className="max-w-md">
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            >
              {subjectOfferings.map((so) => (
                <option key={so.id} value={so.id}>
                  {so.subject.name} ({so.academicYear})
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* ── Tabla de alumnos ── */}
      {selectedSubjectId && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <SectionTitle icon={icons.student}>
              Alumnos ({students.length})
            </SectionTitle>
          </div>

          <SearchInput
            placeholder="Buscar alumno por nombre o email..."
            onSearch={setSearch}
          />

          {loadingStudents ? (
            <SkeletonTable columns={5} rows={6} />
          ) : filteredStudents.length === 0 ? (
            <EmptyState
              title="Sin alumnos"
              description={search ? "No hay alumnos que coincidan con la búsqueda." : "No hay alumnos matriculados en esta asignatura."}
            />
          ) : (
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Insignias</TableHead>
                    <TableHead>Tareas</TableHead>
                    <TableHead>Recompensas canjeadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => {
                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell className="text-text-muted">{student.email}</TableCell>
                        <TableCell>
                          <Badge variant={student.badgeCount > 0 ? "success" : "neutral"}>
                            {student.badgeCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <TaskCompletionIndicator tasks={student.tasks || []} />
                        </TableCell>
                        <TableCell className="text-text-muted">
                          {student.redemptions && student.redemptions.length > 0
                            ? student.redemptions.map((r) => r.rewardName).join(", ")
                            : "—"
                          }
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
