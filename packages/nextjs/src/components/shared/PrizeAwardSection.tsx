"use client";

/**
 * PrizeAwardSection — Bloque de un premio dentro del detalle de tarea
 * en modo revisión. Contiene:
 *   - Cabecera del premio (nombre, descripción, cupo, ya otorgados)
 *   - Tabla de alumnos (entregados arriba, no entregados abajo) con checkboxes
 *   - Botón "Otorgar premio" con su propio estado
 *
 * Los premios son independientes: cada bloque mantiene su propia selección.
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/Table";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { cn } from "@/lib/utils";

interface StudentRow {
  id: string;
  name: string;
  email: string;
  submitted: boolean;
  awardedPrizeIds: string[];
}

interface PrizeAwardSectionProps {
  prize: {
    id: string;
    name: string;
    description: string | null;
    badgeReward: number;
    maxWinners: number;
    awards: Array<{ id: string; user: { id: string; name: string } }>;
  };
  students: StudentRow[];
  /** Desactiva toda acción (por ejemplo si la tarea está CLOSED). */
  disabled?: boolean;
  /** Callback tras otorgar premio con éxito (para refrescar datos). */
  onAwarded: () => void;
}

export function PrizeAwardSection({
  prize,
  students,
  disabled,
  onAwarded,
}: PrizeAwardSectionProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = prize.maxWinners - prize.awards.length;
  const exceedsLimit = selected.size > remaining;
  const nonSubmittedSelected = students.some((s) => selected.has(s.id) && !s.submitted);

  // Ordena: entregados primero (alfabético), no entregados después (alfabético)
  const orderedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [students]);

  function toggle(studentId: string) {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function handleClick() {
    setError(null);
    if (selected.size === 0) {
      setError("Selecciona al menos un alumno");
      return;
    }
    if (exceedsLimit) {
      setError(`Solo quedan ${remaining} ganadores disponibles`);
      return;
    }
    if (nonSubmittedSelected) {
      setConfirmOpen(true);
    } else {
      void doAward();
    }
  }

  async function doAward() {
    setSubmitting(true);
    setConfirmOpen(false);
    setError(null);
    try {
      const res = await fetch(`/api/badges/prizes/${prize.id}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [...selected] }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error otorgando premio");
      setSelected(new Set());
      onAwarded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error otorgando premio");
    } finally {
      setSubmitting(false);
    }
  }

  const isFull = remaining === 0;

  return (
    <Card className="space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-text">{prize.name}</h3>
          {prize.description && (
            <p className="text-sm text-text-muted mt-1">{prize.description}</p>
          )}
          <p className="text-xs text-text-muted mt-2">
            {prize.badgeReward} insignia{prize.badgeReward !== 1 ? "s" : ""} por ganador ·{" "}
            Quedan <strong>{remaining}</strong> de {prize.maxWinners}
          </p>
        </div>
        <Badge variant={isFull ? "neutral" : "info"}>
          {prize.awards.length}/{prize.maxWinners}
        </Badge>
      </div>

      {/* Ganadores ya otorgados */}
      {prize.awards.length > 0 && (
        <div className="rounded-lg bg-bg border border-border-default p-3 text-sm">
          <p className="font-medium text-text mb-1">Ya premiados:</p>
          <ul className="flex flex-wrap gap-1.5">
            {prize.awards.map((a) => (
              <li
                key={a.id}
                className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"
              >
                {a.user.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabla de alumnos */}
      {!isFull && !disabled && (
        <>
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
                {orderedStudents.map((s) => {
                  const alreadyAwarded = s.awardedPrizeIds.includes(prize.id);
                  return (
                    <TableRow
                      key={s.id}
                      className={cn(
                        alreadyAwarded ? "opacity-50" : "cursor-pointer",
                      )}
                      onClick={() => !alreadyAwarded && toggle(s.id)}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(s.id)}
                          disabled={alreadyAwarded || submitting}
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

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-text-muted">
              Seleccionados:{" "}
              <strong className={exceedsLimit ? "text-danger" : "text-text"}>
                {selected.size}
              </strong>
              {exceedsLimit && <span className="text-danger ml-2">(supera el máximo)</span>}
            </p>
            <Button
              size="sm"
              onClick={handleClick}
              loading={submitting}
              disabled={selected.size === 0 || exceedsLimit}
            >
              Otorgar a {selected.size} alumno{selected.size !== 1 ? "s" : ""}
            </Button>
          </div>
        </>
      )}

      {isFull && !disabled && (
        <p className="text-sm text-text-muted italic text-center">
          Premio completo — no quedan ganadores disponibles.
        </p>
      )}

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
    </Card>
  );
}
