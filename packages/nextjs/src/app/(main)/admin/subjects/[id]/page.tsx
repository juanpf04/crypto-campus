"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { SectionTitle } from "@/components/shared/SectionTitle";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";

interface Offering {
  id: string;
  group: string;
  academicYear: string;
  professor: { id: string; name: string };
  _count?: { enrollments: number };
}

interface SubjectDetail {
  id: string;
  name: string;
  code: string;
  offerings: Offering[];
}

export default function AdminSubjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [subject, setSubject] = useState<SubjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/academic/subjects/${id}`);
      if (!res.ok) throw new Error((await res.json()).error);
      setSubject(await res.json());
    } catch {
      addToast("Error al cargar asignatura", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="space-y-6">
        <BackLink href="/admin/subjects" label="Volver a asignaturas" />
        <EmptyState title="No encontrada" description="No se encontró la asignatura." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BackLink href="/admin/subjects" label="Volver a asignaturas" />

      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text">{subject.name}</h1>
            <Badge variant="info">{subject.code}</Badge>
          </div>
        </div>
        <Button variant="secondary" onClick={() => router.push(`/admin/subjects/${id}/edit`)}>
          Editar
        </Button>
      </div>

      {/* Sección: Ofertas */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle icon={icons.items}>Ofertas</SectionTitle>
          <Button size="sm" onClick={() => router.push(`/admin/subjects/${id}/offerings/new`)}>
            Crear oferta
          </Button>
        </div>

        {subject.offerings.length === 0 ? (
          <EmptyState
            title="Sin ofertas"
            description="Aún no se ha creado ninguna oferta para esta asignatura."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profesor</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>N.º alumnos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subject.offerings.map((offering) => (
                  <TableRow
                    key={offering.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/subjects/offerings/${offering.id}`)}
                  >
                    <TableCell className="font-medium">{offering.professor?.name ?? "—"}</TableCell>
                    <TableCell>{offering.group}</TableCell>
                    <TableCell>{offering.academicYear}</TableCell>
                    <TableCell>{offering._count?.enrollments ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}
