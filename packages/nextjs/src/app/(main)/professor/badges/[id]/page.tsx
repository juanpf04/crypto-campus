"use client";

/**
 * Detalle de una assignment del profesor.
 *
 * Muestra info, premios con sus ganadores y entregas. Permite cerrar
 * para revisión y cerrar definitivamente.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";

interface AssignmentDetail {
  id: string;
  name: string;
  description: string | null;
  status: "OPEN" | "REVIEWING" | "CLOSED";
  deadline: string | null;
  autoClose: boolean;
  createdAt: string;
  closedAt: string | null;
  subjectBadge: {
    subjectOffering: {
      group: string; academicYear: string;
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

const STATUS_BADGE = {
  OPEN:      { label: "Abierta",     variant: "success" as const },
  REVIEWING: { label: "En revisión", variant: "warning" as const },
  CLOSED:    { label: "Cerrada",     variant: "neutral" as const },
};

export default function ProfessorAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();

  const [data, setData] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/badges/assignments/${id}`);
      if (res.ok) setData(await res.json());
      else throw new Error("No se pudo cargar la tarea");
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

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  if (!data) return null;

  const offering = data.subjectBadge.subjectOffering;
  const status = STATUS_BADGE[data.status];

  return (
    <div className="space-y-6">
      <BackLink href="/professor/badges" label="Volver a tareas" />

      {/* ── Cabecera ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">{data.name}</h1>
          <p className="text-text-muted mt-1">
            {offering.subject.code} · {offering.subject.name} ({offering.group} · {offering.academicYear})
          </p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {data.description && (
        <Card>
          <p className="text-sm text-text">{data.description}</p>
        </Card>
      )}

      {/* ── Acciones de estado ── */}
      <div className="flex flex-wrap gap-3">
        {data.status === "OPEN" && (
          <Button variant="outline" onClick={() => setReviewModalOpen(true)}>
            Cerrar entregas (pasar a revisión)
          </Button>
        )}
        {data.status !== "CLOSED" && (
          <Button variant="danger" onClick={() => setCloseModalOpen(true)}>
            Cerrar tarea definitivamente
          </Button>
        )}
        {data.deadline && (
          <p className="text-xs text-text-muted self-center">
            Fecha límite: {new Date(data.deadline).toLocaleString("es-ES")}
            {data.autoClose && " (auto-cierre activo)"}
          </p>
        )}
      </div>

      {/* ── Premios ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.reward}>Premios</SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.prizes.map((p) => {
            const remaining = p.maxWinners - p.awards.length;
            return (
              <Card key={p.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-text">{p.name}</h3>
                    {p.description && <p className="text-sm text-text-muted mt-1">{p.description}</p>}
                  </div>
                  <Badge variant={remaining === 0 ? "neutral" : "info"}>
                    {p.awards.length}/{p.maxWinners}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">{p.badgeReward} insignia{p.badgeReward !== 1 ? "s" : ""} por ganador</span>
                </div>
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
                {data.status !== "CLOSED" && remaining > 0 && (
                  <Link href={`/professor/badges/${id}/prizes/${p.id}/award`}>
                    <Button size="sm" className="w-full">Otorgar premio</Button>
                  </Link>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Entregas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.student}>Entregas ({data.submissions.length})</SectionTitle>
        {data.submissions.length === 0 ? (
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
                {data.submissions.map((s) => (
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
        description="Los alumnos ya no podrán marcar como entregada. Tú aún podrás otorgar premios."
        confirmLabel="Cerrar entregas"
        variant="primary"
        loading={acting}
      />

      <ConfirmModal
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        onConfirm={() => handleAction("close")}
        title="Cerrar tarea definitivamente"
        description="Una vez cerrada no podrás otorgar más premios. Esta acción no se puede deshacer."
        confirmLabel="Cerrar tarea"
        variant="danger"
        loading={acting}
      />
    </div>
  );
}
