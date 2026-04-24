"use client";

/**
 * Inventario de recompensas de los alumnos del profesor.
 * El profesor elige una de sus asignaturas y ve, por alumno, qué recompensas
 * tiene canjeadas, disponibles y pendientes de aprobación.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { SkeletonPage, SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  StudentRewardsInventoryTable,
  type InventoryStudentRow,
} from "@/components/dashboard/StudentRewardsInventoryTable";

interface Offering {
  id: string;
  group: string;
  academicYear: string;
  subject: { name: string; code: string };
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

export default function ProfessorStudentsRewardsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const offeringParam = searchParams.get("offering");
  const { addToast } = useToast();

  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [loadingInventory, setLoadingInventory] = useState(false);

  // Carga inicial: lista de offerings del profesor
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/badges/subject-offerings");
        if (res.ok) setOfferings(await res.json());
      } catch {
        addToast("Error al cargar asignaturas", "danger");
      } finally {
        setLoadingOfferings(false);
      }
    }
    load();
  }, [addToast]);

  // Cuando hay offering seleccionado, cargar inventario
  const loadInventory = useCallback(async () => {
    if (!offeringParam) {
      setInventory(null);
      return;
    }
    setLoadingInventory(true);
    try {
      const res = await fetch(`/api/badges/offerings/${offeringParam}/rewards-inventory`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      setInventory(await res.json());
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al cargar inventario", "danger");
      setInventory(null);
    } finally {
      setLoadingInventory(false);
    }
  }, [offeringParam, addToast]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  function setOffering(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("offering", id);
    else params.delete("offering");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/professor/students/rewards");
  }

  const offeringOptions = useMemo(
    () =>
      offerings.map((o) => ({
        value: o.id,
        label: `${o.subject.code} · ${o.group} · ${o.academicYear}`,
      })),
    [offerings],
  );

  if (loadingOfferings) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href="/professor/students" label="Volver a alumnos" />

      <div>
        <h1 className="text-2xl font-bold text-text">Recompensas de mis alumnos</h1>
        <p className="text-text-muted mt-1">
          Selecciona una asignatura para ver el inventario de recompensas de cada alumno.
        </p>
      </div>

      {offeringOptions.length === 0 ? (
        <EmptyState
          title="Sin asignaturas"
          description="Aún no impartes ninguna asignatura."
        />
      ) : (
        <>
          <div>
            <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">
              Asignatura
            </p>
            <CategoryFilter
              categories={offeringOptions}
              selected={offeringParam}
              onSelect={setOffering}
            />
          </div>

          {!offeringParam ? (
            <Card className="py-12 text-center">
              <p className="text-text-muted">
                Elige una asignatura para ver el inventario de recompensas.
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
        </>
      )}
    </div>
  );
}
