"use client";

/**
 * Otorgar insignias a alumnos (admin).
 *
 * Carga el detalle del badge type, localiza la tarea seleccionada,
 * obtiene los alumnos de la asignatura vinculada y permite otorgar
 * la insignia a cada alumno con un botón individual.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { SectionTitle } from "@/components/shared/SectionTitle";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";

interface Task {
  id: string;
  name: string;
  rewardAmount: number;
  active: boolean;
}

interface BadgeTypeDetail {
  id: string;
  name: string;
  subjectOffering: { id: string; subject: { name: string } };
  tasks: Task[];
}

interface Student {
  id: string;
  name: string;
  email: string;
  totalBadges: number;
  tasksCompleted: { taskId: string; taskName: string; completed: boolean }[];
}

interface Award {
  user: { id: string; name: string; email: string };
  awardedAt: string;
}

export default function AdminAwardBadgePage() {
  const { id, taskId } = useParams<{ id: string; taskId: string }>();
  const { addToast } = useToast();

  const [badgeType, setBadgeType] = useState<BadgeTypeDetail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [awarding, setAwarding] = useState<string | null>(null);

  const task = badgeType?.tasks.find((t) => t.id === taskId);

  const loadData = useCallback(async () => {
    if (!id || !taskId) return;
    try {
      // Cargar badge type detail
      const btRes = await fetch(`/api/badges/types/${id}`);
      if (!btRes.ok) throw new Error("Error al cargar tipo de insignia");
      const btData: BadgeTypeDetail = await btRes.json();
      setBadgeType(btData);

      // Cargar alumnos de la asignatura y otorgamientos de la tarea en paralelo
      const [studentsRes, awardsRes] = await Promise.all([
        fetch(`/api/badges/students/${btData.subjectOffering.id}`),
        fetch(`/api/badges/tasks/${taskId}/awards`),
      ]);

      if (studentsRes.ok) {
        const sData = await studentsRes.json();
        setStudents(sData.students ?? []);
      }
      if (awardsRes.ok) {
        setAwards(await awardsRes.json());
      }
    } catch {
      addToast("Error al cargar datos", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, taskId, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const awardedStudentIds = new Set(awards.map((a) => a.user.id));

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

  if (!badgeType || !task) {
    return (
      <div className="space-y-6">
        <BackLink href={`/admin/badges/types/${id}`} label="Volver al tipo de insignia" />
        <EmptyState title="No encontrado" description="No se encontró la tarea solicitada." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href={`/admin/badges/types/${id}`} label="Volver al tipo de insignia" />

      <div>
        <h1 className="text-2xl font-bold text-text">Otorgar insignia</h1>
        <p className="text-text-muted mt-1">
          Tarea: <strong className="text-text">{task.name}</strong> ({task.rewardAmount} tokens) — {badgeType.name}
        </p>
      </div>

      {/* ── Buscador ── */}
      <SearchInput
        placeholder="Buscar alumno por nombre o email..."
        onSearch={setSearch}
      />

      {/* ── Tabla de alumnos ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.student}>
          Alumnos ({filteredStudents.length})
        </SectionTitle>

        {filteredStudents.length === 0 ? (
          <EmptyState
            title="Sin alumnos"
            description={search ? "No se encontraron alumnos con ese filtro." : "No hay alumnos matriculados en esta asignatura."}
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Badges totales</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => {
                  const alreadyAwarded = awardedStudentIds.has(student.id);
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell className="text-text-muted">{student.email}</TableCell>
                      <TableCell>{student.totalBadges}</TableCell>
                      <TableCell>
                        {alreadyAwarded ? (
                          <span className="text-sm text-success font-medium">Otorgada</span>
                        ) : (
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
