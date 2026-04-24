"use client";

/**
 * Alumnos matriculados en una asignatura (admin).
 * Permite matricular nuevos alumnos (multi-select) y desmatricular existentes.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { icons } from "@/components/ui/icons";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/Table";

interface StudentRow {
  enrollmentId: string;
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
  professor: { name: string };
  enrollmentCount: number;
}

interface AvailableStudent {
  id: string;
  name: string;
  email: string;
}

export default function AdminOfferingStudentsPage() {
  const params = useParams<{ offeringId: string }>();
  const offeringId = params.offeringId;
  const { addToast } = useToast();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [offering, setOffering] = useState<OfferingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal de matricular
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [available, setAvailable] = useState<AvailableStudent[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [availableSearch, setAvailableSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enrolling, setEnrolling] = useState(false);

  // Modal de desmatricular
  const [toUnenroll, setToUnenroll] = useState<StudentRow | null>(null);
  const [unenrolling, setUnenrolling] = useState(false);

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

  async function openEnrollModal() {
    setEnrollModalOpen(true);
    setSelectedIds(new Set());
    setAvailableSearch("");
    setAvailableLoading(true);
    try {
      const res = await fetch(`/api/academic/students/available/${offeringId}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      setAvailable(await res.json());
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al cargar alumnos disponibles", "danger");
      setEnrollModalOpen(false);
    } finally {
      setAvailableLoading(false);
    }
  }

  function toggleSelected(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleConfirmEnroll() {
    if (selectedIds.size === 0) return;
    setEnrolling(true);
    const ids = [...selectedIds];
    let ok = 0;
    let errors = 0;
    try {
      for (const userId of ids) {
        const res = await fetch("/api/academic/enrollments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, subjectOfferingId: offeringId }),
        });
        if (res.ok) ok++; else errors++;
      }
      if (ok > 0) {
        addToast(
          ok === 1 ? "1 alumno matriculado" : `${ok} alumnos matriculados`,
          "success",
        );
      }
      if (errors > 0) {
        addToast(`${errors} matriculacion(es) fallida(s)`, "danger");
      }
      setEnrollModalOpen(false);
      await load();
    } finally {
      setEnrolling(false);
    }
  }

  async function handleConfirmUnenroll() {
    if (!toUnenroll) return;
    setUnenrolling(true);
    try {
      const res = await fetch(`/api/academic/enrollments/${toUnenroll.enrollmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      addToast(`${toUnenroll.name} desmatriculado`, "success");
      setToUnenroll(null);
      await load();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setUnenrolling(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }, [students, search]);

  const availableFiltered = useMemo(() => {
    if (!availableSearch.trim()) return available;
    const q = availableSearch.trim().toLowerCase();
    return available.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }, [available, availableSearch]);

  if (loading) return <SkeletonPage />;

  const base = `/admin/subjects/${offeringId}`;

  return (
    <div className="space-y-6">
      <BackLink href={base} label="Volver al resumen" />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text">Alumnos</h1>
          {offering && (
            <p className="text-text-muted mt-1">
              {offering.subjectName} · {offering.subjectCode} · {offering.group} · {offering.academicYear} · Prof. {offering.professor.name}
            </p>
          )}
        </div>
        <Button onClick={openEnrollModal}>
          <span className="flex items-center gap-1.5">
            {icons.plus}
            Añadir alumnos
          </span>
        </Button>
      </div>

      {students.length === 0 ? (
        <EmptyState
          title="Sin alumnos matriculados"
          description="Aún no hay alumnos en esta asignatura. Usa el botón «Añadir alumnos» para matricular."
        />
      ) : (
        <>
          <SearchInput placeholder="Buscar por nombre o email..." onSearch={setSearch} />

          {filtered.length === 0 ? (
            <EmptyState title="Sin resultados" description="Ningún alumno coincide con la búsqueda." />
          ) : (
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Entregas</TableHead>
                    <TableHead>Insignias ganadas</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
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
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => setToUnenroll(s)}
                          className="rounded-md p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer [&_svg]:h-4 [&_svg]:w-4"
                          aria-label={`Desmatricular a ${s.name}`}
                          title="Desmatricular"
                        >
                          {icons.trash}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {/* Modal: matricular */}
      <Modal
        open={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        title="Matricular alumnos"
        className="max-w-xl"
      >
        <div className="space-y-4">
          <SearchInput
            placeholder="Buscar por nombre o email..."
            onSearch={setAvailableSearch}
          />

          {availableLoading ? (
            <p className="text-sm text-text-muted py-6 text-center">Cargando alumnos disponibles...</p>
          ) : available.length === 0 ? (
            <EmptyState
              title="Sin alumnos disponibles"
              description="Todos los alumnos del sistema ya están matriculados en esta asignatura."
            />
          ) : (
            <>
              <p className="text-xs text-text-muted">
                {selectedIds.size === 0
                  ? "Ningún alumno seleccionado"
                  : selectedIds.size === 1
                    ? "1 alumno seleccionado"
                    : `${selectedIds.size} alumnos seleccionados`}
              </p>

              <div className="max-h-[360px] overflow-y-auto rounded-lg border border-border-default divide-y divide-border-default">
                {availableFiltered.length === 0 ? (
                  <p className="text-sm text-text-muted p-4 text-center">Sin resultados.</p>
                ) : (
                  availableFiltered.map((s) => {
                    const checked = selectedIds.has(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex items-center gap-3 p-3 hover:bg-bg/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelected(s.id)}
                          className="h-4 w-4 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text truncate">{s.name}</p>
                          <p className="text-xs text-text-muted truncate">{s.email}</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setEnrollModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmEnroll}
                  disabled={selectedIds.size === 0 || enrolling}
                  loading={enrolling}
                >
                  Matricular {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal: desmatricular */}
      <ConfirmModal
        open={!!toUnenroll}
        onClose={() => setToUnenroll(null)}
        onConfirm={handleConfirmUnenroll}
        loading={unenrolling}
        title="Desmatricular alumno"
        description={
          toUnenroll
            ? `¿Quitar a ${toUnenroll.name} de esta asignatura? Se perderá el vínculo con el grupo, aunque las insignias ya ganadas se conservarán.`
            : ""
        }
        confirmLabel="Desmatricular"
        variant="danger"
      />
    </div>
  );
}
