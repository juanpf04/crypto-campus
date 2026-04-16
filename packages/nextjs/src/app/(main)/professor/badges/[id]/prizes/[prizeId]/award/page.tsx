"use client";

/**
 * Selección de ganadores de un premio.
 *
 * Muestra todos los alumnos matriculados ordenados por entregados primero.
 * Buscador por nombre/email. Selección con checkboxes. Si se incluyen
 * alumnos no entregados se pide confirmación antes de otorgar.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

interface Student {
  id: string;
  name: string;
  email: string;
  submitted: boolean;
  submittedAt: string | null;
  awardedPrizeIds: string[];
}

interface AssignmentMeta {
  id: string;
  name: string;
  status: "OPEN" | "REVIEWING" | "CLOSED";
  subject: string;
  group: string;
}

interface PageData {
  assignment: AssignmentMeta;
  students: Student[];
}

interface PrizeMeta {
  id: string;
  name: string;
  badgeReward: number;
  maxWinners: number;
  awarded: number; // ya otorgados (calculado)
}

export default function AwardPrizePage() {
  const { id, prizeId } = useParams<{ id: string; prizeId: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [data, setData] = useState<PageData | null>(null);
  const [prize, setPrize] = useState<PrizeMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [studentsRes, assignmentRes] = await Promise.all([
        fetch(`/api/badges/assignments/${id}/students`),
        fetch(`/api/badges/assignments/${id}`),
      ]);
      if (!studentsRes.ok || !assignmentRes.ok) throw new Error("No se pudo cargar");
      const studentsBody: PageData = await studentsRes.json();
      const assignmentBody = await assignmentRes.json();
      setData(studentsBody);
      const p = assignmentBody.prizes.find((x: { id: string }) => x.id === prizeId);
      if (!p) throw new Error("Premio no encontrado");
      setPrize({
        id: p.id,
        name: p.name,
        badgeReward: p.badgeReward,
        maxWinners: p.maxWinners,
        awarded: p.awards.length,
      });
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, prizeId, addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.students;
    return data.students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }, [data, search]);

  function toggle(studentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  const remaining = prize ? prize.maxWinners - prize.awarded : 0;
  const exceedsLimit = selected.size > remaining;
  const nonSubmittedSelected = data?.students.some((s) => selected.has(s.id) && !s.submitted) ?? false;

  function handleSubmitClick() {
    if (selected.size === 0) return addToast("Selecciona al menos un alumno", "danger");
    if (exceedsLimit) return addToast(`Solo quedan ${remaining} ganadores disponibles`, "danger");
    if (nonSubmittedSelected) {
      setConfirmOpen(true);
    } else {
      void doAward();
    }
  }

  async function doAward() {
    setSubmitting(true);
    setConfirmOpen(false);
    try {
      const res = await fetch(`/api/badges/prizes/${prizeId}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [...selected] }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error otorgando premio");
      addToast(`Premio otorgado a ${body.awarded} alumno${body.awarded !== 1 ? "s" : ""}`, "success");
      router.push(`/professor/badges/${id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  if (!data || !prize) return null;

  return (
    <div className="space-y-6">
      <BackLink href={`/professor/badges/${id}`} label="Volver a la tarea" />

      <div>
        <h1 className="text-2xl font-bold text-text">Otorgar premio: {prize.name}</h1>
        <p className="text-text-muted mt-1">
          {data.assignment.name} · {data.assignment.subject} · {data.assignment.group}
        </p>
        <p className="text-sm text-text-muted mt-2">
          {prize.badgeReward} insignias por ganador · Quedan <strong>{remaining}</strong> de {prize.maxWinners}
        </p>
      </div>

      <Card className="space-y-4">
        <Input
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="text-sm text-text-muted">
          Seleccionados: <strong className={exceedsLimit ? "text-danger" : "text-text"}>{selected.size}</strong>
          {exceedsLimit && <span className="text-danger ml-2">(supera el máximo)</span>}
        </div>

        <div className="overflow-hidden rounded-lg border border-border-default">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Alumno</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const alreadyAwarded = s.awardedPrizeIds.includes(prizeId);
                return (
                  <TableRow
                    key={s.id}
                    className={alreadyAwarded ? "opacity-50" : "cursor-pointer"}
                    onClick={() => !alreadyAwarded && toggle(s.id)}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        disabled={alreadyAwarded}
                        onChange={() => toggle(s.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-border-default cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-text-muted">{s.email}</TableCell>
                    <TableCell>
                      {alreadyAwarded ? (
                        <Badge variant="info">Ya premiado</Badge>
                      ) : s.submitted ? (
                        <Badge variant="success">Entregado</Badge>
                      ) : (
                        <Badge variant="neutral">No entregado</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button onClick={handleSubmitClick} loading={submitting} disabled={selected.size === 0 || exceedsLimit}>
          Otorgar premio a {selected.size} alumno{selected.size !== 1 ? "s" : ""}
        </Button>
      </div>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doAward}
        title="Algunos alumnos no han entregado"
        description="Has seleccionado alumnos que no marcaron la tarea como entregada. ¿Quieres otorgarles el premio igualmente?"
        confirmLabel="Sí, otorgar"
        variant="primary"
        loading={submitting}
      />
    </div>
  );
}
