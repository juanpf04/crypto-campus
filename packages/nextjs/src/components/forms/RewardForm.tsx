"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input, Select, Textarea } from "@/components/ui";

export type RewardCategoryValue = "TIEMPO" | "EXAMEN" | "PRACTICA" | "CONSULTA" | "OTROS";

export interface RewardFormData {
  name: string;
  description: string;
  badgeCost: string;
  supply: string;
  category: RewardCategoryValue;
  subjectOfferingId: string;
}

interface RewardFormProps {
  onSubmit: (data: RewardFormData) => Promise<void> | void;
  initialValues?: Partial<RewardFormData>;
  isEdit?: boolean;
  /**
   * Si se pasa, el selector de asignatura NO se muestra y se usa este ID.
   * Útil en páginas anidadas bajo una asignatura.
   */
  fixedOfferingId?: string;
  /**
   * Opciones de asignaturas. Requerido cuando `fixedOfferingId` no se pasa.
   */
  subjectOfferings?: { value: string; label: string }[];
}

const CATEGORY_OPTIONS: { value: RewardCategoryValue; label: string }[] = [
  { value: "TIEMPO", label: "⏰ Tiempo (plazos, duración)" },
  { value: "EXAMEN", label: "📝 Examen (puntos, preguntas)" },
  { value: "PRACTICA", label: "💻 Práctica (puntos, entregas)" },
  { value: "CONSULTA", label: "💬 Consulta (tutorías, preguntas)" },
  { value: "OTROS", label: "🎁 Otros" },
];

export function RewardForm({
  onSubmit,
  initialValues,
  isEdit,
  fixedOfferingId,
  subjectOfferings,
}: RewardFormProps) {
  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<RewardFormData>({
    initialValues: {
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      badgeCost: initialValues?.badgeCost ?? "",
      supply: initialValues?.supply ?? "0",
      category: initialValues?.category ?? "OTROS",
      subjectOfferingId: initialValues?.subjectOfferingId ?? fixedOfferingId ?? "",
    },
    validate: (v) => {
      const e: Partial<Record<keyof RewardFormData, string>> = {};
      if (!v.name) e.name = "El nombre es obligatorio";
      const cost = parseInt(v.badgeCost);
      if (isNaN(cost) || cost < 1) e.badgeCost = "El coste debe ser al menos 1 insignia";
      const supply = parseInt(v.supply);
      if (isNaN(supply) || supply < 0) e.supply = "El stock no puede ser negativo";
      if (!fixedOfferingId && !v.subjectOfferingId) e.subjectOfferingId = "Selecciona una asignatura";
      return e;
    },
    onSubmit: (data) =>
      onSubmit({
        ...data,
        subjectOfferingId: fixedOfferingId ?? data.subjectOfferingId,
      }),
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
      <Select
        label="Categoría"
        options={CATEGORY_OPTIONS}
        value={fields.category}
        onChange={setField("category")}
        error={errors.category}
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
      {!fixedOfferingId && subjectOfferings && (
        <Select
          label="Asignatura"
          options={subjectOfferings}
          value={fields.subjectOfferingId}
          onChange={setField("subjectOfferingId")}
          error={errors.subjectOfferingId}
          placeholder="Selecciona asignatura"
          disabled={isEdit}
        />
      )}
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Crear recompensa"}
      </Button>
    </form>
  );
}
