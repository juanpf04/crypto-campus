"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input, Select, Textarea } from "@/components/ui";

export interface RewardFormData {
  name: string;
  description: string;
  badgeCost: string;
  supply: string;
  subjectOfferingId: string;
}

interface RewardFormProps {
  onSubmit: (data: RewardFormData) => Promise<void> | void;
  initialValues?: Partial<RewardFormData>;
  isEdit?: boolean;
  subjectOfferings: { value: string; label: string }[];
}

export function RewardForm({ onSubmit, initialValues, isEdit, subjectOfferings }: RewardFormProps) {
  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<RewardFormData>({
    initialValues: {
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      badgeCost: initialValues?.badgeCost ?? "",
      supply: initialValues?.supply ?? "0",
      subjectOfferingId: initialValues?.subjectOfferingId ?? "",
    },
    validate: (v) => {
      const e: Partial<Record<keyof RewardFormData, string>> = {};
      if (!v.name) e.name = "El nombre es obligatorio";
      const cost = parseInt(v.badgeCost);
      if (isNaN(cost) || cost < 1) e.badgeCost = "El coste debe ser al menos 1 insignia";
      const supply = parseInt(v.supply);
      if (isNaN(supply) || supply < 0) e.supply = "El stock no puede ser negativo";
      if (!v.subjectOfferingId) e.subjectOfferingId = "Selecciona una asignatura";
      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nombre de la recompensa"
        placeholder="Ej: Punto extra en examen"
        value={fields.name}
        onChange={setField("name")}
        error={errors.name}
      />
      <Textarea
        label="Descripción (opcional)"
        placeholder="Describe la recompensa"
        value={fields.description}
        onChange={setField("description")}
        error={errors.description}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Coste (en insignias)"
          type="number"
          min="1"
          placeholder="3"
          value={fields.badgeCost}
          onChange={setField("badgeCost")}
          error={errors.badgeCost}
        />
        <Input
          label="Unidades disponibles (0 = ilimitado)"
          type="number"
          min="0"
          placeholder="0"
          value={fields.supply}
          onChange={setField("supply")}
          error={errors.supply}
        />
      </div>
      <Select
        label="Asignatura"
        options={subjectOfferings}
        value={fields.subjectOfferingId}
        onChange={setField("subjectOfferingId")}
        error={errors.subjectOfferingId}
        placeholder="Selecciona asignatura"
        disabled={isEdit}
      />
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Crear recompensa"}
      </Button>
    </form>
  );
}
