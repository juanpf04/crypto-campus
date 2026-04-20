"use client";

/**
 * Alumnos matriculados en UNA asignatura impartida por el profesor.
 * Tabla simple: nombre, email, entregas realizadas, insignias ganadas.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/Table";

interface StudentRow {
  userId: string;
  name: string;
  email: string;
  submissions: number;
  badgesEarned: number;
}

interface OfferingInfo {
  id: string;
  subjectName: string;
  subjectCode: string;
  group: string;
  academicYear: string;
  enrollmentCount: number;
}

export default function ProfessorOfferingStudentsPage() {
  const params = useParams<{ offeringId: string }>();
  const offeringId = params.offeringId;
  const { addToast } = useToast();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [offering, setOffering] = useState<OfferingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [studentsRes, summaryRes] = await Promise.all([
        fetch(`/api/badges/offerings/${offeringId}/students`),
        fetch(`/api/badges/offerings/${offeringId}/summary`),
      ]);
      if (studentsRes.ok) setStudents(await studentsRes.json());
      if (summaryRes.ok) {
        const body = await summaryRes.json();
        setOffering(body.offering);
      }
    } catch {
      addToast("Error al cargar alumnos", "danger");
    } finally {
      setLoading(false);
    }
  }, [offeringId, addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }, [students, search]);

  if (loading) return <SkeletonPage />;

  const base = `/professor/subjects/${offeringId}`;

  return (
    <div className="space-y-6">
      <BackLink href={base} label="Volver al resumen" />

      <div>
        <h1 className="text-2xl font-bold text-text">Alumnos</h1>
        {offering && (
          <p className="text-text-muted mt-1">
            {offering.subjectName} · {offering.subjectCode} · {offering.group} · {offering.academicYear}
          </p>
        )}
      </div>

      {students.length === 0 ? (
        <EmptyState
          title="Sin alumnos matriculados"
          description="Aún no hay alumnos en esta asignatura."
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
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Entregas</TableHead>
                    <TableHead>Insignias ganadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.userId}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-text-muted">{s.email}</TableCell>
                      <TableCell>
                        <Badge variant={s.submissions > 0 ? "success" : "neutral"}>
                          {s.submissions}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.badgesEarned > 0 ? "info" : "neutral"}>
                          {s.badgesEarned}
                        </Badge>
                      </TableCell>
                    </TableRow>
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
