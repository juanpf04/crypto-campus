"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input, Select, Textarea } from "@/components/ui";

export interface RewardFormData {
  name: string;
  description: string;
  badgeCost: string;
  supply: string;
  badgeTypeId: string;
}

interface RewardFormProps {
  onSubmit: (data: RewardFormData) => Promise<void> | void;
  initialValues?: Partial<RewardFormData>;
  isEdit?: boolean;
  badgeTypes: { value: string; label: string }[];
}

export function RewardForm({ onSubmit, initialValues, isEdit, badgeTypes }: RewardFormProps) {
  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<RewardFormData>({
    initialValues: {
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      badgeCost: initialValues?.badgeCost ?? "",
      supply: initialValues?.supply ?? "0",
      badgeTypeId: initialValues?.badgeTypeId ?? "",
    },
    validate: (v) => {
      const e: Partial<Record<keyof RewardFormData, string>> = {};
      if (!v.name) e.name = "El nombre es obligatorio";
      if (!v.description) e.description = "La descripción es obligatoria";
      const cost = parseInt(v.badgeCost);
      if (isNaN(cost) || cost < 1) e.badgeCost = "El coste debe ser al menos 1 badge";
      const supply = parseInt(v.supply);
      if (isNaN(supply) || supply < 0) e.supply = "El stock no puede ser negativo";
      if (!v.badgeTypeId) e.badgeTypeId = "Selecciona un tipo de insignia";
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
        label="Descripción"
        placeholder="Describe la recompensa"
        value={fields.description}
        onChange={setField("description")}
        error={errors.description}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Coste (en badges)"
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
        label="Tipo de insignia requerida"
        options={badgeTypes}
        value={fields.badgeTypeId}
        onChange={setField("badgeTypeId")}
        error={errors.badgeTypeId}
        placeholder="Selecciona insignia"
        disabled={isEdit}
      />
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Crear recompensa"}
      </Button>
    </form>
  );
}
