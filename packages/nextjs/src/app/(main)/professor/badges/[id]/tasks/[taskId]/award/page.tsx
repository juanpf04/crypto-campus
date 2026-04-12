"use client";

/**
 * Otorgar insignias de una tarea a alumnos.
 *
 * Flujo:
 * 1. Carga el badge type (para obtener subjectOfferingId y la tarea)
 * 2. Carga los alumnos matriculados en la asignatura
 * 3. Carga los otorgamientos ya realizados para la tarea
 * 4. Muestra la tabla de alumnos con filtro de búsqueda y botón "Otorgar"
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { icons } from "@/components/ui/icons";

interface Student {
  id: string;
  name: string;
  email: string;
}

interface Award {
  studentId: string;
}

interface Task {
  id: string;
  name: string;
  rewardAmount: number;
}

interface BadgeTypeInfo {
  id: string;
  name: string;
  subjectOffering: { id: string; subject: { name: string } };
  tasks: Task[];
}

export default function ProfessorAwardBadgePage() {
  const { id, taskId } = useParams<{ id: string; taskId: string }>();
  const { addToast } = useToast();

  const [badgeType, setBadgeType] = useState<BadgeTypeInfo | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [awarding, setAwarding] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    if (!id || !taskId) return;
    try {
      // Cargar badge type para obtener la tarea y el subjectOfferingId
      const btRes = await fetch(`/api/badges/types/${id}`);
      if (!btRes.ok) throw new Error("Error al cargar tipo de insignia");
      const btData: BadgeTypeInfo = await btRes.json();
      setBadgeType(btData);

      const foundTask = btData.tasks.find((t) => t.id === taskId);
      setTask(foundTask ?? null);

      // Cargar alumnos y otorgamientos en paralelo
      const [studentsRes, awardsRes] = await Promise.all([
        fetch(`/api/badges/students/${btData.subjectOffering.id}`),
        fetch(`/api/badges/tasks/${taskId}/awards`),
      ]);

      if (studentsRes.ok) setStudents(await studentsRes.json());
      if (awardsRes.ok) setAwards(await awardsRes.json());
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al cargar datos", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, taskId, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleAward(studentId: string) {
    setAwarding(studentId);
    try {
      const res = await fetch(`/api/badges/tasks/${taskId}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al otorgar insignia");
      }

      addToast("Insignia otorgada correctamente", "success");
      loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al otorgar insignia", "danger");
    } finally {
      setAwarding(null);
    }
  }

  const awardedStudentIds = new Set(awards.map((a) => a.studentId));

  const filteredStudents = students.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href={`/professor/badges/${id}`} label="Volver al tipo de insignia" />

      <div>
        <h1 className="text-2xl font-bold text-text">Otorgar insignias</h1>
        {task && (
          <p className="text-text-muted mt-1">
            Tarea: <strong className="text-text">{task.name}</strong>
            {" "}({task.rewardAmount} tokens)
          </p>
        )}
        {badgeType && (
          <p className="text-text-muted text-sm mt-1">
            {badgeType.name} &middot; {badgeType.subjectOffering.subject.name}
          </p>
        )}
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <SectionTitle icon={icons.student}>Alumnos matriculados</SectionTitle>
          <span className="text-sm text-text-muted">
            {awardedStudentIds.size}/{students.length} otorgados
          </span>
        </div>

        <SearchInput
          placeholder="Buscar alumno por nombre o email..."
          onSearch={setSearch}
        />

        {filteredStudents.length === 0 ? (
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
                  <TableHead>Estado</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => {
                  const isAwarded = awardedStudentIds.has(student.id);
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell className="text-text-muted">{student.email}</TableCell>
                      <TableCell>
                        {isAwarded ? (
                          <Badge variant="success">
                            <span className="flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Otorgada
                            </span>
                          </Badge>
                        ) : (
                          <Badge variant="neutral">Pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!isAwarded && (
                          <Button
                            size="sm"
                            onClick={() => handleAward(student.id)}
                            loading={awarding === student.id}
                          >
                            Otorgar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}
