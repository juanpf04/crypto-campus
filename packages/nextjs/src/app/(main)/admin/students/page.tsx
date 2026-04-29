"use client";

/**
 * Vista global de alumnos (admin). Tabla con TODOS los alumnos del sistema,
 * buscador, filtro por asignatura (al seleccionar, solo muestra matriculados
 * en esa asignatura) y filas expandibles con todas las matrículas del alumno.
 *
 * Desde el desplegable se puede:
 * - Matricular al alumno en otra asignatura (modal multi-select de ofertas
 *   en las que aún no está).
 * - Desmatricular de una matrícula concreta (modal de confirmación).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import {
  Table, TableBody, TableHead, TableHeader, TableRow,
} from "@/components/ui/Table";
import {
  StudentGlobalRow,
  type StudentGlobalData,
  type StudentGlobalOffering,
} from "@/components/shared/StudentGlobalRow";

interface Offering {
  id: string;
  group: string;
  academicYear: string;
  subject: { name: string; code: string };
  professor?: { id: string; name: string };
}

export default function AdminStudentsGlobalPage() {
  const { addToast } = useToast();

  const [students, setStudents] = useState<StudentGlobalData[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  // Modal: matricular en otras asignaturas
  const [enrollFor, setEnrollFor] = useState<{ userId: string; name: string } | null>(null);
  const [enrollSearch, setEnrollSearch] = useState("");
  const [selectedOfferings, setSelectedOfferings] = useState<Set<string>>(new Set());
  const [enrolling, setEnrolling] = useState(false);

  // Modal: confirmar desmatriculación
  const [unenrollFor, setUnenrollFor] = useState<
    | { enrollmentId: string; studentName: string; offeringLabel: string }
    | null
  >(null);
  const [unenrolling, setUnenrolling] = useState(false);

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

  // ── Matricular ──────────────────────────────────────────────────────────
  function openEnrollModal(userId: string) {
    const student = students.find((s) => s.userId === userId);
    if (!student) return;
    setEnrollFor({ userId, name: student.name });
    setEnrollSearch("");
    setSelectedOfferings(new Set());
  }

  /** Ofertas en las que el alumno NO está ya matriculado. */
  const availableOfferings = useMemo(() => {
    if (!enrollFor) return [];
    const student = students.find((s) => s.userId === enrollFor.userId);
    if (!student) return [];
    const enrolledIds = new Set(student.offerings.map((o) => o.offeringId));
    return offerings.filter((o) => !enrolledIds.has(o.id));
  }, [enrollFor, students, offerings]);

  const enrollFiltered = useMemo(() => {
    const q = enrollSearch.trim().toLowerCase();
    if (!q) return availableOfferings;
    return availableOfferings.filter((o) => {
      const hay = `${o.subject.name} ${o.subject.code} ${o.group} ${o.professor?.name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [availableOfferings, enrollSearch]);

  function toggleOfferingSelected(offeringId: string) {
    setSelectedOfferings((prev) => {
      const next = new Set(prev);
      if (next.has(offeringId)) next.delete(offeringId);
      else next.add(offeringId);
      return next;
    });
  }

  async function handleConfirmEnroll() {
    if (!enrollFor || selectedOfferings.size === 0) return;
    setEnrolling(true);
    let ok = 0;
    let errors = 0;
    try {
      for (const offeringId of selectedOfferings) {
        const res = await fetch("/api/academic/enrollments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: enrollFor.userId, subjectOfferingId: offeringId }),
        });
        if (res.ok) ok++; else errors++;
      }
      if (ok > 0) {
        addToast(
          ok === 1
            ? `${enrollFor.name} matriculado en 1 asignatura`
            : `${enrollFor.name} matriculado en ${ok} asignaturas`,
          "success",
        );
      }
      if (errors > 0) {
        addToast(`${errors} matriculación(es) fallida(s)`, "danger");
      }
      setEnrollFor(null);
      await load();
    } finally {
      setEnrolling(false);
    }
  }

  // ── Desmatricular ───────────────────────────────────────────────────────
  function openUnenrollModal(student: StudentGlobalData, offering: StudentGlobalOffering) {
    if (!offering.enrollmentId) return;
    setUnenrollFor({
      enrollmentId: offering.enrollmentId,
      studentName: student.name,
      offeringLabel: `${offering.subjectName} (${offering.subjectCode} · ${offering.group})`,
    });
  }

  async function handleConfirmUnenroll() {
    if (!unenrollFor) return;
    setUnenrolling(true);
    try {
      const res = await fetch(`/api/academic/enrollments/${unenrollFor.enrollmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      addToast(`${unenrollFor.studentName} desmatriculado de ${unenrollFor.offeringLabel}`, "success");
      setUnenrollFor(null);
      await load();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setUnenrolling(false);
    }
  }

  // ── Filtros / render ────────────────────────────────────────────────────
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
          Todos los alumnos del campus. Pincha una fila para gestionar sus matrículas.
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
                  onEnroll={() => openEnrollModal(s.userId)}
                  onUnenroll={(offering) => openUnenrollModal(s, offering)}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Modal: matricular en otras asignaturas */}
      <Modal
        open={enrollFor !== null}
        onClose={() => { if (!enrolling) setEnrollFor(null); }}
        title={enrollFor ? `Matricular a ${enrollFor.name}` : ""}
        className="max-w-xl"
      >
        <div className="space-y-4">
          <SearchInput
            placeholder="Buscar por asignatura, código, grupo o profesor..."
            onSearch={setEnrollSearch}
          />

          {availableOfferings.length === 0 ? (
            <EmptyState
              title="Sin asignaturas disponibles"
              description="Este alumno ya está matriculado en todas las asignaturas existentes."
            />
          ) : (
            <>
              <p className="text-xs text-text-muted">
                {selectedOfferings.size === 0
                  ? "Ninguna asignatura seleccionada"
                  : selectedOfferings.size === 1
                    ? "1 asignatura seleccionada"
                    : `${selectedOfferings.size} asignaturas seleccionadas`}
              </p>

              <div className="max-h-[360px] overflow-y-auto rounded-lg border border-border-default divide-y divide-border-default">
                {enrollFiltered.length === 0 ? (
                  <p className="text-sm text-text-muted p-4 text-center">Sin resultados.</p>
                ) : (
                  enrollFiltered.map((o) => {
                    const checked = selectedOfferings.has(o.id);
                    return (
                      <label
                        key={o.id}
                        className="flex items-center gap-3 p-3 hover:bg-bg/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOfferingSelected(o.id)}
                          className="h-4 w-4 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text truncate">
                            {o.subject.name}
                          </p>
                          <p className="text-xs text-text-muted truncate">
                            {o.subject.code} · {o.group} · {o.academicYear}
                            {o.professor?.name && <> · Prof. {o.professor.name}</>}
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="danger" onClick={() => setEnrollFor(null)} disabled={enrolling}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmEnroll}
                  disabled={selectedOfferings.size === 0 || enrolling}
                  loading={enrolling}
                >
                  Matricular {selectedOfferings.size > 0 ? `(${selectedOfferings.size})` : ""}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal: confirmar desmatricular */}
      <ConfirmModal
        open={!!unenrollFor}
        onClose={() => { if (!unenrolling) setUnenrollFor(null); }}
        onConfirm={handleConfirmUnenroll}
        loading={unenrolling}
        title="Desmatricular alumno"
        description={
          unenrollFor
            ? `¿Quitar a ${unenrollFor.studentName} de ${unenrollFor.offeringLabel}? Se perderá el vínculo con el grupo, aunque las insignias ya ganadas se conservarán.`
            : ""
        }
        confirmLabel="Desmatricular"
      />
    </div>
  );
}
