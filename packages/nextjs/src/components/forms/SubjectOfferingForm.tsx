"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input, Select } from "@/components/ui";

export interface SubjectOfferingFormData {
  subjectId: string;
  professorId: string;
  group: string;
  academicYear: string;
}

interface SubjectOfferingFormProps {
  onSubmit: (data: SubjectOfferingFormData) => Promise<void> | void;
  initialValues?: Partial<SubjectOfferingFormData>;
  isEdit?: boolean;
  subjects: { value: string; label: string }[];
  professors: { value: string; label: string }[];
}

export function SubjectOfferingForm({
  onSubmit,
  initialValues,
  isEdit,
  subjects,
  professors,
}: SubjectOfferingFormProps) {
  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<SubjectOfferingFormData>({
    initialValues: {
      subjectId: initialValues?.subjectId ?? "",
      professorId: initialValues?.professorId ?? "",
      group: initialValues?.group ?? "",
      academicYear: initialValues?.academicYear ?? "",
    },
    validate: (v) => {
      const e: Partial<Record<keyof SubjectOfferingFormData, string>> = {};
      if (!v.subjectId) e.subjectId = "Selecciona una asignatura";
      if (!v.professorId) e.professorId = "Selecciona un profesor";
      if (!v.group) e.group = "El grupo es obligatorio";
      if (!v.academicYear) e.academicYear = "El curso académico es obligatorio";
      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Select
        label="Asignatura"
        options={subjects}
        value={fields.subjectId}
        onChange={setField("subjectId")}
        error={errors.subjectId}
        placeholder="Selecciona asignatura"
        disabled={isEdit}
      />
      <Select
        label="Profesor"
        options={professors}
        value={fields.professorId}
        onChange={setField("professorId")}
        error={errors.professorId}
        placeholder="Selecciona profesor"
        disabled={isEdit}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Grupo"
          placeholder="Ej: 2ºE"
          value={fields.group}
          onChange={setField("group")}
          error={errors.group}
        />
        <Input
          label="Curso académico"
          placeholder="Ej: 2025-2026"
          value={fields.academicYear}
          onChange={setField("academicYear")}
          error={errors.academicYear}
        />
      </div>
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Crear oferta"}
      </Button>
    </form>
  );
}
