"use client";

/**
 * Hub de "Asignaturas del campus" para admin.
 * Tabla agrupada por asignatura: cada fila representa una asignatura y es
 * desplegable para mostrar sus grupos (SubjectOfferings). El render de cada
 * fila (+ acciones + subtabla) está en components/dashboard/SubjectExpandableRow.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SearchInput } from "@/components/ui/SearchInput";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table, TableBody, TableHead, TableHeader, TableRow,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";
import {
  SubjectExpandableRow,
  type SubjectRowOffering,
  type SubjectRowSubject,
} from "@/components/dashboard/SubjectExpandableRow";

interface Professor {
  id: string;
  name: string;
  email: string;
}

type RawOffering = SubjectRowOffering & {
  subject: { id: string; name: string; code: string };
};

const COLUMN_COUNT = 6;

export default function AdminSubjectsHubPage() {
  const { addToast } = useToast();

  const [rawOfferings, setRawOfferings] = useState<RawOffering[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [profFilter, setProfFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [offeringsRes, profsRes] = await Promise.all([
        fetch("/api/badges/subject-offerings"),
        fetch("/api/badges/professors"),
      ]);
      if (offeringsRes.ok) setRawOfferings(await offeringsRes.json());
      if (profsRes.ok) setProfessors(await profsRes.json());
    } catch {
      addToast("Error al cargar asignaturas", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const yearOptions = useMemo(() => {
    const set = new Set(rawOfferings.map((o) => o.academicYear));
    return [...set].sort().reverse().map((y) => ({ value: y, label: y }));
  }, [rawOfferings]);

  const profOptions = useMemo(
    () => professors.map((p) => ({ value: p.id, label: p.name })),
    [professors],
  );

  // Filtrado de grupos (offerings) según buscador + filtros
  const filteredOfferings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawOfferings.filter((o) => {
      if (yearFilter && o.academicYear !== yearFilter) return false;
      if (profFilter && o.professor.id !== profFilter) return false;
      if (q) {
        const hay = `${o.subject.name} ${o.subject.code} ${o.group} ${o.professor.name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rawOfferings, search, yearFilter, profFilter]);

  // Agrupado por asignatura
  const subjects = useMemo<SubjectRowSubject[]>(() => {
    const map = new Map<string, SubjectRowSubject>();
    for (const o of filteredOfferings) {
      const existing = map.get(o.subject.id);
      if (existing) {
        existing.offerings.push(o);
        existing.studentsTotal += o._count.enrollments;
      } else {
        map.set(o.subject.id, {
          id: o.subject.id,
          name: o.subject.name,
          code: o.subject.code,
          offerings: [o],
          studentsTotal: o._count.enrollments,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [filteredOfferings]);

  function toggleExpand(subjectId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  }

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin" label="Volver al panel" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Asignaturas del campus</h1>
          <p className="text-text-muted mt-1">
            {rawOfferings.length} grupo{rawOfferings.length !== 1 ? "s" : ""} impartido{rawOfferings.length !== 1 ? "s" : ""} en total
          </p>
        </div>
        <Link href="/admin/subjects/catalog/new">
          <Button>
            <span className="flex items-center gap-1.5">
              {icons.plus}
              Crear asignatura
            </span>
          </Button>
        </Link>
      </div>

      {rawOfferings.length === 0 ? (
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

          {subjects.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              description="Ninguna asignatura coincide con los filtros."
            />
          ) : (
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Código</TableHead>
                    <TableHead>Asignatura</TableHead>
                    <TableHead>Grupos</TableHead>
                    <TableHead>Alumnos</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((s) => (
                    <SubjectExpandableRow
                      key={s.id}
                      subject={s}
                      isOpen={expanded.has(s.id)}
                      onToggle={() => toggleExpand(s.id)}
                      columnCount={COLUMN_COUNT}
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
