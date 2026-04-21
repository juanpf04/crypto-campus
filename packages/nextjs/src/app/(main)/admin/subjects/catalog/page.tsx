"use client";

/**
 * Catálogo de Subjects (entidades genéricas: código + nombre).
 * Las Subjects son el "master" que luego se instancian como SubjectOfferings
 * (profesor × grupo × año académico).
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

interface Subject {
  id: string;
  name: string;
  code: string;
  _count?: { offerings: number };
}

export default function AdminSubjectsCatalogPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/academic/subjects");
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setSubjects(Array.isArray(data) ? data : data.subjects ?? []);
    } catch {
      addToast("Error al cargar asignaturas", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  if (loading && subjects.length === 0) return <SkeletonTable columns={3} rows={6} />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/subjects" label="Volver a asignaturas del campus" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Catálogo de asignaturas</h1>
          <p className="text-text-muted mt-1">
            {subjects.length} asignatura{subjects.length !== 1 ? "s" : ""} en el catálogo del campus
          </p>
        </div>
        <Button onClick={() => router.push("/admin/subjects/catalog/new")}>
          Crear asignatura
        </Button>
      </div>

      {subjects.length === 0 ? (
        <EmptyState title="Sin asignaturas" description="No se ha creado ninguna asignatura." />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>N.º ofertas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((subject) => (
                <TableRow
                  key={subject.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/admin/subjects/catalog/${subject.id}`)}
                >
                  <TableCell className="font-mono text-sm">{subject.code}</TableCell>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>{subject._count?.offerings ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
