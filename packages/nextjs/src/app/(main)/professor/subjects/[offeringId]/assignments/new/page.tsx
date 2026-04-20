"use client";

/**
 * Crear nueva tarea dentro de UNA asignatura concreta.
 * La asignatura viene en la URL — no hay selector.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { icons } from "@/components/ui/icons";

interface OfferingInfo {
  id: string;
  subjectName: string;
  subjectCode: string;
  group: string;
  academicYear: string;
}

interface PrizeForm {
  name: string;
  description: string;
  badgeReward: number;
  maxWinners: number;
}

const EMPTY_PRIZE: PrizeForm = { name: "", description: "", badgeReward: 5, maxWinners: 1 };

export default function NewAssignmentPage() {
  const params = useParams<{ offeringId: string }>();
  const offeringId = params.offeringId;
  const router = useRouter();
  const { addToast } = useToast();

  const [offering, setOffering] = useState<OfferingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [autoClose, setAutoClose] = useState(false);
  const [prizes, setPrizes] = useState<PrizeForm[]>([{ ...EMPTY_PRIZE, name: "Mejor entrega" }]);

  useEffect(() => {
    fetch(`/api/badges/offerings/${offeringId}/summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body) setOffering(body.offering);
      })
      .catch(() => addToast("Error al cargar asignatura", "danger"))
      .finally(() => setLoading(false));
  }, [offeringId, addToast]);

  function updatePrize(index: number, patch: Partial<PrizeForm>) {
    setPrizes((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPrize() {
    setPrizes((prev) => [...prev, { ...EMPTY_PRIZE }]);
  }

  function removePrize(index: number) {
    setPrizes((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return addToast("Escribe un nombre", "danger");
    if (prizes.some((p) => !p.name.trim())) return addToast("Cada premio necesita un nombre", "danger");
    if (prizes.some((p) => p.badgeReward < 1 || p.maxWinners < 1))
      return addToast("Cantidades deben ser >= 1", "danger");

    setSubmitting(true);
    try {
      const res = await fetch("/api/badges/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectOfferingId: offeringId,
          name: name.trim(),
          description: description.trim() || undefined,
          deadline: deadline || null,
          autoClose,
          prizes: prizes.map((p) => ({
            name: p.name.trim(),
            description: p.description.trim() || undefined,
            badgeReward: p.badgeReward,
            maxWinners: p.maxWinners,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al crear tarea");

      addToast("Tarea creada correctamente", "success");
      router.push(`/professor/subjects/${offeringId}/assignments/${body.assignment.id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al crear tarea", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <SkeletonPage />;

  const base = `/professor/subjects/${offeringId}`;

  return (
    <div className="space-y-6">
      <BackLink href={`${base}/assignments`} label="Volver a tareas" />

      <div>
        <h1 className="text-2xl font-bold text-text">Nueva tarea</h1>
        {offering && (
          <p className="text-text-muted mt-1">
            {offering.subjectName} · {offering.subjectCode} · {offering.group} · {offering.academicYear}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos generales */}
        <Card className="space-y-4">
          <SectionTitle icon={icons.task}>Datos de la tarea</SectionTitle>

          <Input
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Práctica 1 - Página web"
            required
          />

          <Textarea
            label="Descripción (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalles de la entrega, requisitos, etc."
            rows={3}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Fecha límite (opcional)"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <div className="flex flex-col justify-end gap-2">
              <Toggle
                label="Auto-cerrar al pasar la fecha"
                checked={autoClose}
                onChange={setAutoClose}
                disabled={!deadline}
              />
              <p className="text-xs text-text-muted">
                Si está activo, al pasar el deadline pasa a &quot;En revisión&quot; automáticamente.
              </p>
            </div>
          </div>
        </Card>

        {/* Premios */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionTitle icon={icons.reward}>Premios</SectionTitle>
            <Button type="button" variant="secondary" size="sm" onClick={addPrize}>
              + Añadir premio
            </Button>
          </div>

          <div className="space-y-3">
            {prizes.map((prize, idx) => (
              <div key={idx} className="rounded-lg border border-border-default p-4 space-y-3 bg-bg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text">Premio #{idx + 1}</span>
                  {prizes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePrize(idx)}
                      className="text-xs text-danger hover:underline cursor-pointer"
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                <Input
                  label="Nombre del premio"
                  value={prize.name}
                  onChange={(e) => updatePrize(idx, { name: e.target.value })}
                  placeholder="Mejor diseño, Mejor nota, Más útil..."
                  required
                />

                <Input
                  label="Descripción (opcional)"
                  value={prize.description}
                  onChange={(e) => updatePrize(idx, { description: e.target.value })}
                  placeholder="Criterio de evaluación de este premio"
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Insignias por ganador"
                    type="number"
                    min={1}
                    value={prize.badgeReward}
                    onChange={(e) => updatePrize(idx, { badgeReward: Number(e.target.value) })}
                  />
                  <Input
                    label="Nº máximo de ganadores"
                    type="number"
                    min={1}
                    value={prize.maxWinners}
                    onChange={(e) => updatePrize(idx, { maxWinners: Number(e.target.value) })}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Crear tarea
          </Button>
        </div>
      </form>
    </div>
  );
}
