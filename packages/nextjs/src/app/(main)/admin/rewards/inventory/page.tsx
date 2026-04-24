"use client";

/**
 * Inventario de recompensas de los alumnos (admin).
 *
 * Filtros obligatorios: asignatura + profesor. Una vez seleccionados ambos,
 * se resuelve el offering concreto (si hay más de un grupo, se muestra un
 * tercer selector para elegirlo). Luego se muestra el inventario por alumno.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { SkeletonPage, SkeletonTable } from "@/components/ui/Skeleton";
import {
  StudentRewardsInventoryTable,
  type InventoryStudentRow,
} from "@/components/dashboard/StudentRewardsInventoryTable";

interface Offering {
  id: string;
  group: string;
  academicYear: string;
  subject: { id?: string; name: string; code: string };
  professor: { id: string; name: string };
}

interface Professor {
  id: string;
  name: string;
}

interface InventoryResponse {
  offering: {
    id: string;
    subjectName: string;
    subjectCode: string;
    group: string;
    academicYear: string;
  };
  students: InventoryStudentRow[];
}

export default function AdminRewardsInventoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectCode = searchParams.get("subject");
  const professorId = searchParams.get("professor");
  const offeringId = searchParams.get("offering");
  const { addToast } = useToast();

  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [loadingInventory, setLoadingInventory] = useState(false);

  // Carga inicial: todas las offerings + todos los profesores
  useEffect(() => {
    async function load() {
      try {
        const [offsRes, profsRes] = await Promise.all([
          fetch("/api/badges/subject-offerings"),
          fetch("/api/badges/professors"),
        ]);
        if (offsRes.ok) setOfferings(await offsRes.json());
        if (profsRes.ok) setProfessors(await profsRes.json());
      } catch {
        addToast("Error al cargar filtros", "danger");
      } finally {
        setLoadingLists(false);
      }
    }
    load();
  }, [addToast]);

  // Cargar inventario cuando el offering quede determinado
  const loadInventory = useCallback(async () => {
    if (!offeringId) {
      setInventory(null);
      return;
    }
    setLoadingInventory(true);
    try {
      const res = await fetch(`/api/badges/offerings/${offeringId}/rewards-inventory`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      setInventory(await res.json());
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al cargar inventario", "danger");
      setInventory(null);
    } finally {
      setLoadingInventory(false);
    }
  }, [offeringId, addToast]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Opciones únicas de asignatura (por código) y profesor
  const subjectOptions = useMemo(() => {
    const seen = new Set<string>();
    const items: { value: string; label: string }[] = [];
    for (const o of offerings) {
      if (seen.has(o.subject.code)) continue;
      seen.add(o.subject.code);
      items.push({ value: o.subject.code, label: `${o.subject.code} · ${o.subject.name}` });
    }
    return items.sort((a, b) => a.label.localeCompare(b.label));
  }, [offerings]);

  const professorOptions = useMemo(
    () => professors.map((p) => ({ value: p.id, label: p.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [professors],
  );

  // Offerings que coinciden con los dos filtros. Si hay >1, el admin debe elegir grupo.
  const candidateOfferings = useMemo(() => {
    if (!subjectCode || !professorId) return [];
    return offerings.filter(
      (o) => o.subject.code === subjectCode && o.professor.id === professorId,
    );
  }, [offerings, subjectCode, professorId]);

  // Auto-seleccionar offering si solo hay uno y aún no está en la query
  useEffect(() => {
    if (!subjectCode || !professorId) return;
    if (candidateOfferings.length === 1 && !offeringId) {
      setQuery({ offering: candidateOfferings[0].id });
    }
    // Si el offeringId actual no está dentro de los candidatos (filtros cambiados), limpiar
    if (offeringId && !candidateOfferings.some((o) => o.id === offeringId)) {
      setQuery({ offering: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateOfferings, offeringId]);

  function setQuery(next: Partial<Record<"subject" | "professor" | "offering", string | null>>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(next)) {
      if (val === null || val === undefined) params.delete(key);
      else params.set(key, val);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/admin/rewards/inventory");
  }

  if (loadingLists) return <SkeletonPage />;

  const subjectSelected = Boolean(subjectCode);
  const professorSelected = Boolean(professorId);
  const needsDisambiguation = candidateOfferings.length > 1 && !offeringId;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/rewards" label="Volver a recompensas" />

      <div>
        <h1 className="text-2xl font-bold text-text">Inventario de recompensas por alumno</h1>
        <p className="text-text-muted mt-1">
          Elige asignatura y profesor para ver qué recompensas tiene cada alumno del grupo.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">Asignatura</p>
          <CategoryFilter
            categories={subjectOptions}
            selected={subjectCode}
            onSelect={(val) => setQuery({ subject: val, offering: null })}
          />
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">Profesor</p>
          <CategoryFilter
            categories={professorOptions}
            selected={professorId}
            onSelect={(val) => setQuery({ professor: val, offering: null })}
          />
        </div>

        {needsDisambiguation && (
          <div>
            <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">
              Grupo · curso
            </p>
            <CategoryFilter
              categories={candidateOfferings.map((o) => ({
                value: o.id,
                label: `${o.group} · ${o.academicYear}`,
              }))}
              selected={offeringId}
              onSelect={(val) => setQuery({ offering: val })}
            />
          </div>
        )}
      </div>

      {!subjectSelected || !professorSelected ? (
        <Card className="py-12 text-center">
          <p className="text-text-muted">
            Selecciona una asignatura y un profesor para continuar.
          </p>
        </Card>
      ) : candidateOfferings.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-text-muted">
            Esta combinación de asignatura y profesor no corresponde a ningún grupo.
          </p>
        </Card>
      ) : needsDisambiguation ? (
        <Card className="py-12 text-center">
          <p className="text-text-muted">
            Hay varios grupos que coinciden. Elige uno arriba.
          </p>
        </Card>
      ) : loadingInventory ? (
        <SkeletonTable columns={6} rows={6} />
      ) : inventory ? (
        <>
          <p className="text-sm text-text-muted">
            {inventory.offering.subjectName} · {inventory.offering.subjectCode} ·{" "}
            {inventory.offering.group} · {inventory.offering.academicYear} ·{" "}
            {inventory.students.length} alumno{inventory.students.length !== 1 ? "s" : ""}
          </p>
          <StudentRewardsInventoryTable students={inventory.students} />
        </>
      ) : null}
    </div>
  );
}
