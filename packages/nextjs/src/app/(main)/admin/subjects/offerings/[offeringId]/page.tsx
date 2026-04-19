"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";

interface Enrollment {
  id: string;
  user: { id: string; name: string; email: string };
  createdAt: string;
}

interface OfferingDetail {
  id: string;
  group: string;
  academicYear: string;
  subject: { id: string; name: string; code: string };
  professor: { id: string; name: string };
  enrollments: Enrollment[];
}

interface AvailableStudent {
  id: string;
  name: string;
  email: string;
}

export default function AdminOfferingDetailPage() {
  const { offeringId } = useParams<{ offeringId: string }>();
  const { addToast } = useToast();

  const [offering, setOffering] = useState<OfferingDetail | null>(null);
  const [availableStudents, setAvailableStudents] = useState<AvailableStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [unenrolling, setUnenrolling] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!offeringId) return;
    try {
      const [offeringRes, studentsRes] = await Promise.all([
        fetch(`/api/academic/offerings/${offeringId}`),
        fetch(`/api/academic/students/available/${offeringId}`),
      ]);

      if (!offeringRes.ok) throw new Error("Error al cargar oferta");
      const offeringData = await offeringRes.json();
      setOffering(offeringData);

      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        setAvailableStudents(Array.isArray(studentsData) ? studentsData : []);
      }
    } catch {
      addToast("Error al cargar datos", "danger");
    } finally {
      setLoading(false);
    }
  }, [offeringId, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleEnroll() {
    if (!selectedStudentId) return;
    setEnrolling(true);
    try {
      const res = await fetch(`/api/academic/offerings/${offeringId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedStudentId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al matricular");
      }
      addToast("Alumno matriculado", "success");
      setSelectedStudentId("");
      loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al matricular", "danger");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleUnenroll(enrollmentId: string) {
    setUnenrolling(enrollmentId);
    try {
      const res = await fetch(`/api/academic/enrollments/${enrollmentId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al desmatricular");
      }
      addToast("Alumno desmatriculado", "success");
      loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al desmatricular", "danger");
    } finally {
      setUnenrolling(null);
    }
  }

  if (loading) return <SkeletonPage />;

  if (!offering) {
    return (
      <div className="space-y-6">
        <BackLink href="/admin/subjects" label="Volver a asignaturas" />
        <EmptyState title="No encontrada" description="No se encontró la oferta." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BackLink href={`/admin/subjects/${offering.subject.id}`} label={`Volver a ${offering.subject.name}`} />

      {/* Cabecera */}
      <div>
        <h1 className="text-2xl font-bold text-text">
          {offering.subject.name} — {offering.group}
        </h1>
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-text-muted">
          <span>Asignatura: <strong className="text-text">{offering.subject.code} — {offering.subject.name}</strong></span>
          <span>Profesor: <strong className="text-text">{offering.professor?.name ?? "—"}</strong></span>
          <span>Grupo: <strong className="text-text">{offering.group}</strong></span>
          <span>Curso: <strong className="text-text">{offering.academicYear}</strong></span>
        </div>
      </div>

      {/* Sección: Alumnos matriculados */}
      <section className="space-y-4">
        <SectionTitle icon={icons.users}>Alumnos matriculados</SectionTitle>

        {offering.enrollments.length === 0 ? (
          <EmptyState
            title="Sin alumnos"
            description="Aún no hay alumnos matriculados en esta oferta."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Fecha matrícula</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offering.enrollments.map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell className="font-medium">{enrollment.user.name}</TableCell>
                    <TableCell className="text-text-muted">{enrollment.user.email}</TableCell>
                    <TableCell className="text-text-muted">
                      {new Date(enrollment.createdAt).toLocaleDateString("es-ES")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleUnenroll(enrollment.id)}
                        loading={unenrolling === enrollment.id}
                      >
                        Desmatricular
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      {/* Sección: Matricular alumno */}
      <section className="space-y-4">
        <SectionTitle icon={icons.student}>Matricular alumno</SectionTitle>

        {availableStudents.length === 0 ? (
          <p className="text-text-muted text-sm">No hay estudiantes disponibles para matricular.</p>
        ) : (
          <Card className="p-4">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label htmlFor="student-select" className="block text-sm font-medium text-text mb-1">
                  Seleccionar alumno
                </label>
                <select
                  id="student-select"
                  className="w-full rounded-lg border border-border-default bg-card px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                >
                  <option value="">Selecciona un alumno...</option>
                  {availableStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleEnroll}
                loading={enrolling}
                disabled={!selectedStudentId}
              >
                Matricular
              </Button>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
