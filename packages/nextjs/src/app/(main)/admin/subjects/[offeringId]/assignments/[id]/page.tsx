"use client";

/**
 * Detalle de una tarea (admin). Modo revisión unificado: cuando está OPEN o
 * REVIEWING, cada premio se muestra con su tabla de alumnos y su botón de
 * otorgar (reutilizando PrizeAwardSection). Cuando está CLOSED, solo lectura.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { PrizeAwardSection } from "@/components/shared/PrizeAwardSection";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";

type Status = "OPEN" | "REVIEWING" | "CLOSED";

interface AssignmentDetail {
  id: string;
  name: string;
  description: string | null;
  status: Status;
  deadline: string | null;
  autoClose: boolean;
  createdAt: string;
  closedAt: string | null;
  subjectBadge: {
    subjectOfferingId: string;
    subjectOffering: {
      group: string;
      academicYear: string;
      subject: { name: string; code: string };
      professor: { id: string; name: string };
    };
  };
  prizes: Array<{
    id: string;
    name: string;
    description: string | null;
    badgeReward: number;
    maxWinners: number;
    awards: Array<{ id: string; user: { id: string; name: string; email: string } }>;
  }>;
  submissions: Array<{ id: string; submittedAt: string; student: { id: string; name: string; email: string } }>;
}

interface StudentsResponse {
  assignment: { id: string; name: string; status: Status };
  students: Array<{
    id: string;
    name: string;
    email: string;
    submitted: boolean;
    submittedAt: string | null;
    awardedPrizeIds: string[];
  }>;
}

const STATUS_BADGE: Record<Status, { label: string; variant: "success" | "warning" | "neutral" }> = {
  OPEN:      { label: "Abierta",     variant: "success" },
  REVIEWING: { label: "En revisión", variant: "warning" },
  CLOSED:    { label: "Cerrada",     variant: "neutral" },
};

export default function AdminAssignmentDetailPage() {
  const params = useParams<{ offeringId: string; id: string }>();
  const { offeringId, id } = params;
  const { addToast } = useToast();

  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [studentsData, setStudentsData] = useState<StudentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [detailRes, studentsRes] = await Promise.all([
        fetch(`/api/badges/assignments/${id}`),
        fetch(`/api/badges/assignments/${id}/students`),
      ]);
      if (!detailRes.ok) {
        const body = await detailRes.json();
        throw new Error(body.error ?? "No se pudo cargar la tarea");
      }
      setDetail(await detailRes.json());
      if (studentsRes.ok) setStudentsData(await studentsRes.json());
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(endpoint: "review" | "close") {
    setActing(true);
    try {
      const res = await fetch(`/api/badges/assignments/${id}/${endpoint}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error");
      }
      addToast(endpoint === "review" ? "Entregas cerradas" : "Tarea cerrada definitivamente", "success");
      setReviewModalOpen(false);
      setCloseModalOpen(false);
      load();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setActing(false);
    }
  }

  if (loading) return <SkeletonPage />;
  if (!detail) {
    return <EmptyState title="Tarea no encontrada" description="No se pudo cargar la información de esta tarea." />;
  }

  const base = `/admin/subjects/${offeringId}`;
  const status = STATUS_BADGE[detail.status];
  const isEditable = detail.status !== "CLOSED";
  const offering = detail.subjectBadge.subjectOffering;

  return (
    <div className="space-y-6">
      <BackLink href={`${base}/assignments`} label="Volver a tareas" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">{detail.name}</h1>
          <p className="text-text-muted mt-1">
            {offering.subject.code} · {offering.subject.name} ({offering.group} · {offering.academicYear}) · Prof. {offering.professor.name}
          </p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {detail.description && (
        <Card>
          <p className="text-sm text-text">{detail.description}</p>
        </Card>
      )}

      {isEditable && (
        <div className="flex flex-wrap items-center gap-3">
          {detail.status === "OPEN" && (
            <Button variant="secondary" onClick={() => setReviewModalOpen(true)}>
              Cerrar entregas (pasar a revisión)
            </Button>
          )}
          <Button variant="danger" onClick={() => setCloseModalOpen(true)}>
            Cerrar tarea definitivamente
          </Button>
          {detail.deadline && (
            <p className="text-xs text-text-muted">
              Fecha límite: {new Date(detail.deadline).toLocaleString("es-ES")}
              {detail.autoClose && " (auto-cierre activo)"}
            </p>
          )}
        </div>
      )}

      <section className="space-y-4">
        <SectionTitle icon={icons.reward}>Premios</SectionTitle>

        {detail.status === "CLOSED" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {detail.prizes.map((p) => (
              <Card key={p.id} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-text">{p.name}</h3>
                    {p.description && <p className="text-sm text-text-muted mt-1">{p.description}</p>}
                  </div>
                  <Badge variant="neutral">{p.awards.length}/{p.maxWinners}</Badge>
                </div>
                <p className="text-xs text-text-muted">
                  {p.badgeReward} insignia{p.badgeReward !== 1 ? "s" : ""} por ganador
                </p>
                {p.awards.length > 0 && (
                  <div className="text-sm">
                    <p className="font-medium text-text mb-1">Ganadores:</p>
                    <ul className="space-y-0.5">
                      {p.awards.map((a) => (
                        <li key={a.id} className="text-text-muted">{a.user.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {!studentsData && (
              <p className="text-sm text-text-muted italic">Cargando alumnos...</p>
            )}
            {studentsData && detail.prizes.map((p) => (
              <PrizeAwardSection
                key={p.id}
                prize={p}
                students={studentsData.students}
                onAwarded={load}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionTitle icon={icons.student}>
          Entregas ({detail.submissions.length})
        </SectionTitle>
        {detail.submissions.length === 0 ? (
          <EmptyState title="Sin entregas" description="Aún no ha entregado ningún alumno." />
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Entregado el</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.submissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.student.name}</TableCell>
                    <TableCell className="text-text-muted">{s.student.email}</TableCell>
                    <TableCell className="text-text-muted">
                      {new Date(s.submittedAt).toLocaleString("es-ES")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      <ConfirmModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onConfirm={() => handleAction("review")}
        title="Cerrar entregas"
        description="Los alumnos ya no podrán marcar como entregada. Aún podrás otorgar premios."
        confirmLabel="Cerrar entregas"
        loading={acting}
      />
      <ConfirmModal
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        onConfirm={() => handleAction("close")}
        title="Cerrar tarea definitivamente"
        description="Una vez cerrada no se podrán otorgar más premios. Esta acción no se puede deshacer."
        confirmLabel="Cerrar tarea"
        loading={acting}
      />
    </div>
  );
}
