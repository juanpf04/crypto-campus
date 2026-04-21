"use client";

/**
 * Hub de "Asignaturas del campus" para admin.
 * Tabla de TODAS las SubjectOfferings del sistema (asignaturas impartidas).
 * Incluye buscador, filtros por año y profesor, y botón "Gestionar catálogo".
 * Cada fila lleva al resumen de la asignatura: /admin/subjects/[offeringId].
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/Table";

interface Offering {
  id: string;
  group: string;
  academicYear: string;
  subject: { name: string; code: string };
  professor: { id: string; name: string; email: string };
  _count: { enrollments: number };
}

interface Professor {
  id: string;
  name: string;
  email: string;
}

export default function AdminSubjectsHubPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [profFilter, setProfFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [offeringsRes, profsRes] = await Promise.all([
        fetch("/api/badges/subject-offerings"),
        fetch("/api/badges/professors"),
      ]);
      if (offeringsRes.ok) setOfferings(await offeringsRes.json());
      if (profsRes.ok) setProfessors(await profsRes.json());
    } catch {
      addToast("Error al cargar asignaturas", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const yearOptions = useMemo(() => {
    const set = new Set(offerings.map((o) => o.academicYear));
    return [...set].sort().reverse().map((y) => ({ value: y, label: y }));
  }, [offerings]);

  const profOptions = useMemo(
    () => professors.map((p) => ({ value: p.id, label: p.name })),
    [professors],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return offerings.filter((o) => {
      if (yearFilter && o.academicYear !== yearFilter) return false;
      if (profFilter && o.professor.id !== profFilter) return false;
      if (q) {
        const hay = `${o.subject.name} ${o.subject.code} ${o.group} ${o.professor.name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [offerings, search, yearFilter, profFilter]);

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin" label="Volver al panel" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Asignaturas del campus</h1>
          <p className="text-text-muted mt-1">
            {offerings.length} asignatura{offerings.length !== 1 ? "s" : ""} impartida{offerings.length !== 1 ? "s" : ""} en total
          </p>
        </div>
        <Link href="/admin/subjects/catalog">
          <Button variant="secondary">Gestionar catálogo</Button>
        </Link>
      </div>

      {offerings.length === 0 ? (
        <EmptyState
          title="Sin asignaturas"
          description="Aún no hay asignaturas impartidas en el sistema."
        />
      ) : (
        <>
          <div className="space-y-3">
            <SearchInput
              placeholder="Buscar por asignatura, grupo o profesor..."
              onSearch={setSearch}
            />

            {yearOptions.length > 1 && (
              <div>
                <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">
                  Año académico
                </p>
                <CategoryFilter
                  categories={yearOptions}
                  selected={yearFilter}
                  onSelect={setYearFilter}
                  showAll
                  allLabel="Todos"
                />
              </div>
            )}

            {profOptions.length > 1 && (
              <div>
                <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">
                  Profesor
                </p>
                <CategoryFilter
                  categories={profOptions}
                  selected={profFilter}
                  onSelect={setProfFilter}
                  showAll
                  allLabel="Todos"
                />
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              description="Ninguna asignatura coincide con los filtros."
            />
          ) : (
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Asignatura</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Año</TableHead>
                    <TableHead>Profesor</TableHead>
                    <TableHead>Alumnos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/admin/subjects/${o.id}`)}
                    >
                      <TableCell className="font-mono text-sm">{o.subject.code}</TableCell>
                      <TableCell className="font-medium">{o.subject.name}</TableCell>
                      <TableCell>{o.group}</TableCell>
                      <TableCell className="text-text-muted">{o.academicYear}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="text-text">{o.professor.name}</p>
                          <p className="text-xs text-text-muted">{o.professor.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={o._count.enrollments > 0 ? "info" : "neutral"}>
                          {o._count.enrollments}
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
