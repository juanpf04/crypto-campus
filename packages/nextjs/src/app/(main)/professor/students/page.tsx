"use client";

/**
 * Vista global de alumnos del profesor: todos los matriculados en
 * cualquiera de sus asignaturas. Cada fila es expandible para ver qué
 * asignaturas comparte con él.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  Table, TableBody, TableHead, TableHeader, TableRow,
} from "@/components/ui/Table";
import { StudentGlobalRow, type StudentGlobalData } from "@/components/shared/StudentGlobalRow";

export default function ProfessorStudentsGlobalPage() {
  const { addToast } = useToast();

  const [students, setStudents] = useState<StudentGlobalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/badges/my-students");
      if (res.ok) setStudents(await res.json());
      else addToast("Error al cargar alumnos", "danger");
    } catch {
      addToast("Error al cargar alumnos", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  function toggleRow(userId: string) {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }, [students, search]);

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href="/professor" label="Volver al panel" />

      <div>
        <h1 className="text-2xl font-bold text-text">Mis alumnos</h1>
        <p className="text-text-muted mt-1">
          Todos los alumnos matriculados en cualquiera de tus asignaturas. Haz click en una fila para ver qué asignaturas comparte contigo.
        </p>
      </div>

      {students.length === 0 ? (
        <EmptyState
          title="Sin alumnos"
          description="Aún no hay alumnos matriculados en tus asignaturas."
        />
      ) : (
        <>
          <SearchInput
            placeholder="Buscar por nombre o email..."
            onSearch={setSearch}
          />

          {filtered.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              description="Ningún alumno coincide con la búsqueda."
            />
          ) : (
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Asignaturas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <StudentGlobalRow
                      key={s.userId}
                      student={s}
                      isOpen={openRows.has(s.userId)}
                      onToggle={() => toggleRow(s.userId)}
                    />
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
