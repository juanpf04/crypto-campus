"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input, Select, Textarea } from "@/components/ui";

export interface BadgeTypeFormData {
  name: string;
  description: string;
  subjectOfferingId: string;
}

interface BadgeTypeFormProps {
  onSubmit: (data: BadgeTypeFormData) => Promise<void> | void;
  initialValues?: Partial<BadgeTypeFormData>;
  isEdit?: boolean;
  subjectOfferings: { value: string; label: string }[];
}

export function BadgeTypeForm({ onSubmit, initialValues, isEdit, subjectOfferings }: BadgeTypeFormProps) {
  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<BadgeTypeFormData>({
    initialValues: {
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      subjectOfferingId: initialValues?.subjectOfferingId ?? "",
    },
    validate: (v) => {
      const e: Partial<Record<keyof BadgeTypeFormData, string>> = {};
      if (!v.name) e.name = "El nombre es obligatorio";
      if (!v.description) e.description = "La descripción es obligatoria";
      if (!v.subjectOfferingId) e.subjectOfferingId = "Selecciona una asignatura";
      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nombre de la insignia"
        placeholder="Ej: Experto en React"
        value={fields.name}
        onChange={setField("name")}
        error={errors.name}
      />
      <Textarea
        label="Descripción"
        placeholder="Describe qué reconoce esta insignia"
        value={fields.description}
        onChange={setField("description")}
        error={errors.description}
      />
      <Select
        label="Asignatura / Grupo"
        options={subjectOfferings}
        value={fields.subjectOfferingId}
        onChange={setField("subjectOfferingId")}
        error={errors.subjectOfferingId}
        placeholder="Selecciona asignatura"
        disabled={isEdit}
      />
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Crear insignia"}
      </Button>
    </form>
  );
}
