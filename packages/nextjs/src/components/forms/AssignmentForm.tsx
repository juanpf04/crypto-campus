"use client";

/**
 * AssignmentForm — Formulario para crear/editar tareas con premios.
 *
 * Usado por admin y profesor (mismos campos y validación; solo cambia el
 * redirect post-submit, que maneja el caller). Permite añadir/quitar
 * premios dinámicamente. Validación inline: cada campo muestra el error
 * debajo a través de la prop `error` del Input/Textarea.
 */

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { icons } from "@/components/ui/icons";

export interface AssignmentPrize {
  name: string;
  description?: string;
  badgeReward: number;
  maxWinners: number;
}

export interface AssignmentFormData {
  name: string;
  description?: string;
  deadline: string | null;
  autoClose: boolean;
  prizes: AssignmentPrize[];
}

interface AssignmentFormProps {
  initialValues?: Partial<AssignmentFormData>;
  onSubmit: (data: AssignmentFormData) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
}

interface PrizeFormState {
  name: string;
  description: string;
  badgeReward: number;
  maxWinners: number;
}

interface PrizeFieldErrors {
  name?: string;
  badgeReward?: string;
  maxWinners?: string;
}

interface AssignmentErrors {
  name?: string;
  prizes: PrizeFieldErrors[];
}

const EMPTY_PRIZE: PrizeFormState = {
  name: "",
  description: "",
  badgeReward: 5,
  maxWinners: 1,
};

function seedPrizes(prizes?: AssignmentPrize[]): PrizeFormState[] {
  if (prizes && prizes.length > 0) {
    return prizes.map((p) => ({
      name: p.name,
      description: p.description ?? "",
      badgeReward: p.badgeReward,
      maxWinners: p.maxWinners,
    }));
  }
  return [{ ...EMPTY_PRIZE, name: "Mejor entrega" }];
}

function emptyErrors(prizeCount: number): AssignmentErrors {
  return { prizes: Array.from({ length: prizeCount }, () => ({})) };
}

function hasAnyError(errs: AssignmentErrors): boolean {
  if (errs.name) return true;
  return errs.prizes.some((e) => e.name || e.badgeReward || e.maxWinners);
}

export function AssignmentForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = "Crear tarea",
}: AssignmentFormProps) {
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [deadline, setDeadline] = useState(initialValues?.deadline ?? "");
  const [autoClose, setAutoClose] = useState(initialValues?.autoClose ?? false);
  const [prizes, setPrizes] = useState<PrizeFormState[]>(() => seedPrizes(initialValues?.prizes));

  const [errors, setErrors] = useState<AssignmentErrors>(() => emptyErrors(prizes.length));

  function clearPrizeError(index: number, field: keyof PrizeFieldErrors) {
    setErrors((prev) => {
      if (!prev.prizes[index]?.[field]) return prev;
      const next = prev.prizes.map((e, i) =>
        i === index ? { ...e, [field]: undefined } : e,
      );
      return { ...prev, prizes: next };
    });
  }

  function updatePrize(index: number, patch: Partial<PrizeFormState>) {
    setPrizes((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    for (const key of Object.keys(patch) as Array<keyof PrizeFormState>) {
      if (key === "name" || key === "badgeReward" || key === "maxWinners") {
        clearPrizeError(index, key);
      }
    }
  }

  function addPrize() {
    setPrizes((prev) => [...prev, { ...EMPTY_PRIZE }]);
    setErrors((prev) => ({ ...prev, prizes: [...prev.prizes, {}] }));
  }

  function removePrize(index: number) {
    setPrizes((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
    setErrors((prev) => ({
      ...prev,
      prizes: prev.prizes.length > 1 ? prev.prizes.filter((_, i) => i !== index) : prev.prizes,
    }));
  }

  function validate(): AssignmentErrors {
    const errs: AssignmentErrors = { prizes: prizes.map(() => ({})) };
    if (!name.trim()) errs.name = "Escribe un nombre para la tarea";

    prizes.forEach((p, i) => {
      const pErr: PrizeFieldErrors = {};
      if (!p.name.trim()) pErr.name = "Escribe un nombre para el premio";
      if (!Number.isInteger(p.badgeReward) || p.badgeReward < 1) {
        pErr.badgeReward = "Debe ser un entero ≥ 1";
      }
      if (!Number.isInteger(p.maxWinners) || p.maxWinners < 1) {
        pErr.maxWinners = "Debe ser un entero ≥ 1";
      }
      errs.prizes[i] = pErr;
    });
    return errs;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const errs = validate();
    setErrors(errs);
    if (hasAnyError(errs)) {
      requestAnimationFrame(() => {
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    const data: AssignmentFormData = {
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
    };

    setSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Datos generales */}
      <Card className="space-y-4">
        <SectionTitle icon={icons.task}>Datos de la tarea</SectionTitle>

        <Input
          label="Nombre"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          placeholder="Ej: Práctica 1 - Página web"
          error={errors.name}
        />

        <Textarea
          label="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej: Subir un PDF con el diseño antes del viernes"
          rows={3}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Fecha límite (opcional)"
            type="datetime-local"
            value={deadline ?? ""}
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
          {prizes.map((prize, idx) => {
            const prizeErr = errors.prizes[idx] ?? {};
            return (
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
                  placeholder="Ej: Mejor diseño, Mejor nota"
                  error={prizeErr.name}
                />

                <Input
                  label="Descripción (opcional)"
                  value={prize.description}
                  onChange={(e) => updatePrize(idx, { description: e.target.value })}
                  placeholder="Ej: Se premia la creatividad del diseño"
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Insignias por ganador"
                    type="number"
                    value={prize.badgeReward}
                    onChange={(e) => updatePrize(idx, { badgeReward: Number(e.target.value) })}
                    error={prizeErr.badgeReward}
                  />
                  <Input
                    label="Nº máximo de ganadores"
                    type="number"
                    value={prize.maxWinners}
                    onChange={(e) => updatePrize(idx, { maxWinners: Number(e.target.value) })}
                    error={prizeErr.maxWinners}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="danger" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
