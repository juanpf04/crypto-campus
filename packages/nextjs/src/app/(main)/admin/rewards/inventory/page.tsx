"use client";

/**
 * Inventario global de recompensas canjeadas (admin).
 *
 * Por defecto lista TODOS los canjes del sistema (alumnos con al menos un
 * canje). Filtros opcionales y combinables: alumno (search), asignatura,
 * profesor y grupo. Todos client-side sobre el dataset cargado, así el
 * filtrado es instantáneo.
 */

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { SearchInput } from "@/components/ui/SearchInput";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  StudentRewardsInventoryTable,
  type InventoryRewardEntry,
  type InventoryStudentRow,
} from "@/components/dashboard/StudentRewardsInventoryTable";

interface InventoryResponse {
  students: InventoryStudentRow[];
}

export default function AdminRewardsInventoryPage() {
  const { addToast } = useToast();

  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [subjectCode, setSubjectCode] = useState<string | null>(null);
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [offeringId, setOfferingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/badges/rewards-inventory");
        if (!res.ok) throw new Error((await res.json()).error ?? "Error");
        setData(await res.json());
      } catch (err) {
        addToast(err instanceof Error ? err.message : "Error al cargar inventario", "danger");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [addToast]);

  // Catálogos de filtros — derivados de las recompensas presentes en la respuesta
  // (solo se ofrecen valores que realmente filtran algo).
  const allRewards = useMemo<InventoryRewardEntry[]>(() => {
    if (!data) return [];
    return data.students.flatMap((s) => s.rewards);
  }, [data]);

  const subjectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of allRewards) {
      if (r.subjectCode && r.subjectName && !seen.has(r.subjectCode)) {
        seen.set(r.subjectCode, r.subjectName);
      }
    }
    return [...seen.entries()]
      .map(([code, name]) => ({ value: code, label: `${code} · ${name}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allRewards]);

  const professorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of allRewards) {
      if (r.professorId && r.professorName && !seen.has(r.professorId)) {
        seen.set(r.professorId, r.professorName);
      }
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allRewards]);

  // Grupo solo se ofrece cuando los filtros de arriba reducen a algo concreto;
  // si no, ofrecer todos los grupos sería ruidoso.
  const offeringOptions = useMemo(() => {
    if (!subjectCode && !professorId) return [];
    const matching = allRewards.filter((r) => {
      if (subjectCode && r.subjectCode !== subjectCode) return false;
      if (professorId && r.professorId !== professorId) return false;
      return true;
    });
    const seen = new Map<string, { group: string; year: string }>();
    for (const r of matching) {
      if (r.offeringId && r.group && !seen.has(r.offeringId)) {
        seen.set(r.offeringId, { group: r.group, year: r.academicYear ?? "" });
      }
    }
    return [...seen.entries()]
      .map(([id, info]) => ({ value: id, label: `${info.group} · ${info.year}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allRewards, subjectCode, professorId]);

  // Si cambian filtros y el offering elegido ya no aplica, limpiarlo.
  useEffect(() => {
    if (offeringId && !offeringOptions.some((o) => o.value === offeringId)) {
      setOfferingId(null);
    }
  }, [offeringOptions, offeringId]);

  // Filtrado de alumnos + recompensas
  const filteredStudents = useMemo<InventoryStudentRow[]>(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();

    return data.students
      .filter((s) => {
        if (!q) return true;
        return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
      })
      .map((s) => {
        const rewards = s.rewards.filter((r) => {
          if (subjectCode && r.subjectCode !== subjectCode) return false;
          if (professorId && r.professorId !== professorId) return false;
          if (offeringId && r.offeringId !== offeringId) return false;
          return true;
        });
        // Recalcular totales sobre el subconjunto filtrado.
        let totalRedemptions = 0;
        let totalAvailable = 0;
        let totalPending = 0;
        for (const r of rewards) {
          totalRedemptions += r.redemptions;
          totalAvailable += r.available;
          totalPending += r.pending;
        }
        return { ...s, rewards, totalRedemptions, totalAvailable, totalPending };
      })
      .filter((s) => s.rewards.length > 0);
  }, [data, search, subjectCode, professorId, offeringId]);

  const hasActiveFilter =
    Boolean(search.trim()) || subjectCode !== null || professorId !== null || offeringId !== null;

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/rewards" label="Volver a recompensas" />

      <div>
        <h1 className="text-2xl font-bold text-text">Inventario de recompensas</h1>
        <p className="text-text-muted mt-1">
          Todas las recompensas canjeadas por los alumnos. Filtra por alumno, asignatura, profesor o grupo.
        </p>
      </div>

      <div className="space-y-3">
        <SearchInput
          placeholder="Buscar alumno por nombre o email..."
          onSearch={setSearch}
        />

        {subjectOptions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">
              Asignatura
            </p>
            <CategoryFilter
              categories={subjectOptions}
              selected={subjectCode}
              onSelect={setSubjectCode}
              showAll
              allLabel="Todas"
            />
          </div>
        )}

        {professorOptions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">
              Profesor
            </p>
            <CategoryFilter
              categories={professorOptions}
              selected={professorId}
              onSelect={setProfessorId}
              showAll
              allLabel="Todos"
            />
          </div>
        )}

        {offeringOptions.length > 1 && (
          <div>
            <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">
              Grupo · curso
            </p>
            <CategoryFilter
              categories={offeringOptions}
              selected={offeringId}
              onSelect={setOfferingId}
              showAll
              allLabel="Todos"
            />
          </div>
        )}
      </div>

      {data === null || data.students.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-text-muted">
            Aún no hay recompensas canjeadas en el sistema.
          </p>
        </Card>
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          title={hasActiveFilter ? "Sin resultados" : "Sin canjes"}
          description={
            hasActiveFilter
              ? "Ningún alumno coincide con los filtros aplicados."
              : "Aún no hay recompensas canjeadas."
          }
        />
      ) : (
        <>
          <p className="text-sm text-text-muted">
            {filteredStudents.length} alumno{filteredStudents.length !== 1 ? "s" : ""} con canjes
            {hasActiveFilter ? " (filtrados)" : ""}
          </p>
          <StudentRewardsInventoryTable students={filteredStudents} />
        </>
      )}
    </div>
  );
}
