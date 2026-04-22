"use client";

/**
 * Formulario para crear o editar una impresora física.
 *
 * Campos: identificador y ubicación.
 * En modo edición el identificador no se puede cambiar (es la PK).
 * Reutilizado en /admin/printing/printers/new y .../[id]/edit.
 */

import { useForm } from "@/hooks/useForm";
import { Button, Input } from "@/components/ui";

export interface PrinterFormData {
  id: string;
  location: string;
}

interface PrinterFormProps {
  onSubmit: (data: PrinterFormData) => Promise<void> | void;
  initialValues?: Partial<PrinterFormData>;
  isEdit?: boolean;
}

export function PrinterForm({ onSubmit, initialValues, isEdit }: PrinterFormProps) {
  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<PrinterFormData>({
    initialValues: {
      id: initialValues?.id ?? "",
      location: initialValues?.location ?? "",
    },
    validateOnChange: true,
    validate: (v) => {
      const e: Partial<Record<keyof PrinterFormData, string>> = {};

      if (!v.id.trim()) e.id = "El identificador es obligatorio";
      if (!v.location.trim()) e.location = "La ubicación es obligatoria";

      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Identificador"
        placeholder="Ej: IMP-BIB-01"
        value={fields.id}
        onChange={setField("id")}
        error={errors.id}
        disabled={isEdit}
      />
      <Input
        label="Ubicación"
        placeholder="Ej: Biblioteca, entrada principal"
        value={fields.location}
        onChange={setField("location")}
        error={errors.location}
      />

      {submitError && <p className="text-sm text-danger">{submitError}</p>}

      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Registrar impresora"}
      </Button>
    </form>
  );
}
