"use client";

/**
 * Vista global de alumnos (admin). Tabla con TODOS los alumnos del sistema,
 * buscador, filtro por asignatura (al seleccionar, solo muestra matriculados
 * en esa asignatura) y filas expandibles con todas las matrículas del alumno.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import {
  Table, TableBody, TableHead, TableHeader, TableRow,
} from "@/components/ui/Table";
import {
  StudentGlobalRow,
  type StudentGlobalData,
} from "@/components/shared/StudentGlobalRow";

interface Offering {
  id: string;
  group: string;
  academicYear: string;
  subject: { name: string; code: string };
}

export default function AdminStudentsGlobalPage() {
  const { addToast } = useToast();

  const [students, setStudents] = useState<StudentGlobalData[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [studentsRes, offsRes] = await Promise.all([
        fetch("/api/badges/all-students"),
        fetch("/api/badges/subject-offerings"),
      ]);
      if (studentsRes.ok) setStudents(await studentsRes.json());
      if (offsRes.ok) setOfferings(await offsRes.json());
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

  const subjectOptions = useMemo(
    () => offerings.map((o) => ({
      value: o.id,
      label: `${o.subject.code} · ${o.group}`,
    })),
    [offerings],
  );

  const filtered = useMemo(() => {
    let result = students;
    if (subjectFilter) {
      result = result.filter((s) => s.offerings.some((o) => o.offeringId === subjectFilter));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
      );
    }
    return result;
  }, [students, search, subjectFilter]);

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin" label="Volver al panel" />

      <div>
        <h1 className="text-2xl font-bold text-text">Alumnos</h1>
        <p className="text-text-muted mt-1">
          Todos los alumnos del campus. Pincha una fila para ver las asignaturas en las que está matriculado.
        </p>
      </div>

      <div className="space-y-3">
        <SearchInput placeholder="Buscar por nombre o email..." onSearch={setSearch} />
        {subjectOptions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">
              Filtrar por asignatura
            </p>
            <CategoryFilter
              categories={subjectOptions}
              selected={subjectFilter}
              onSelect={setSubjectFilter}
              showAll
              allLabel="Todas"
            />
          </div>
        )}
      </div>

      {students.length === 0 ? (
        <EmptyState title="Sin alumnos" description="No hay alumnos registrados en el sistema." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="Ningún alumno coincide con los filtros."
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
                  baseHref="/admin/subjects"
                  offeringsHeading="Matrículas del alumno"
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
