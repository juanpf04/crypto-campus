"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input } from "@/components/ui";

export interface SubjectFormData {
  name: string;
  code: string;
}

interface SubjectFormProps {
  onSubmit: (data: SubjectFormData) => Promise<void> | void;
  initialValues?: Partial<SubjectFormData>;
  isEdit?: boolean;
}

export function SubjectForm({ onSubmit, initialValues, isEdit }: SubjectFormProps) {
  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<SubjectFormData>({
    initialValues: {
      name: initialValues?.name ?? "",
      code: initialValues?.code ?? "",
    },
    validate: (v) => {
      const e: Partial<Record<keyof SubjectFormData, string>> = {};
      if (!v.name) e.name = "El nombre es obligatorio";
      if (!v.code) e.code = "El código es obligatorio";
      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nombre de la asignatura"
        placeholder="Ej: Fundamentos de Aplicaciones en Red"
        value={fields.name}
        onChange={setField("name")}
        error={errors.name}
      />
      <Input
        label="Código"
        placeholder="Ej: FAR"
        value={fields.code}
        onChange={setField("code")}
        error={errors.code}
        disabled={isEdit}
      />
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Crear asignatura"}
      </Button>
    </form>
  );
}
