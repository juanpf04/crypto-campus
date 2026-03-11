"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input, Select, Textarea } from "@/components/ui";

export interface TaskFormData {
  name: string;
  description: string;
  rewardAmount: string;
  badgeTypeId: string;
}

interface TaskFormProps {
  onSubmit: (data: TaskFormData) => Promise<void> | void;
  initialValues?: Partial<TaskFormData>;
  isEdit?: boolean;
  badgeTypes: { value: string; label: string }[];
}

export function TaskForm({ onSubmit, initialValues, isEdit, badgeTypes }: TaskFormProps) {
  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<TaskFormData>({
    initialValues: {
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      rewardAmount: initialValues?.rewardAmount ?? "",
      badgeTypeId: initialValues?.badgeTypeId ?? "",
    },
    validate: (v) => {
      const e: Partial<Record<keyof TaskFormData, string>> = {};
      if (!v.name) e.name = "El nombre es obligatorio";
      if (!v.description) e.description = "La descripción es obligatoria";
      const amount = parseInt(v.rewardAmount);
      if (isNaN(amount) || amount < 0) e.rewardAmount = "La recompensa no puede ser negativa";
      if (!v.badgeTypeId) e.badgeTypeId = "Selecciona un tipo de insignia";
      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nombre de la tarea"
        placeholder="Ej: Completar práctica 3"
        value={fields.name}
        onChange={setField("name")}
        error={errors.name}
      />
      <Textarea
        label="Descripción"
        placeholder="Describe qué debe hacer el alumno"
        value={fields.description}
        onChange={setField("description")}
        error={errors.description}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Tokens de recompensa"
          type="number"
          min="0"
          placeholder="5"
          value={fields.rewardAmount}
          onChange={setField("rewardAmount")}
          error={errors.rewardAmount}
        />
        <Select
          label="Tipo de insignia"
          options={badgeTypes}
          value={fields.badgeTypeId}
          onChange={setField("badgeTypeId")}
          error={errors.badgeTypeId}
          placeholder="Selecciona insignia"
          disabled={isEdit}
        />
      </div>
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Crear tarea"}
      </Button>
    </form>
  );
}
