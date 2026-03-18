"use client";

/**
 * Formulario para crear o editar una impresora física.
 *
 * Campos: identificador, nombre, ubicación y planta (opcional).
 * En modo edición el identificador no se puede cambiar (es la PK).
 * Reutilizado en /admin/printing/printers/new y .../[id]/edit.
 */

import { useForm } from "@/hooks/useForm";
import { Button, Input } from "@/components/ui";

export interface PrinterFormData {
  id: string;
  name: string;
  location: string;
  floor: string;
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
      name: initialValues?.name ?? "",
      location: initialValues?.location ?? "",
      floor: initialValues?.floor ?? "",
    },
    validateOnChange: true,
    validate: (v) => {
      const e: Partial<Record<keyof PrinterFormData, string>> = {};

      if (!v.id.trim()) e.id = "El identificador es obligatorio";
      if (!v.name.trim()) e.name = "El nombre es obligatorio";
      if (!v.location.trim()) e.location = "La ubicación es obligatoria";

      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Identificador"
        placeholder="IMP-BIB-01"
        value={fields.id}
        onChange={setField("id")}
        error={errors.id}
        disabled={isEdit}
      />
      <Input
        label="Nombre"
        placeholder="Impresora Biblioteca Planta 1"
        value={fields.name}
        onChange={setField("name")}
        error={errors.name}
      />
      <Input
        label="Ubicación"
        placeholder="Biblioteca, entrada principal"
        value={fields.location}
        onChange={setField("location")}
        error={errors.location}
      />
      <Input
        label="Planta (opcional)"
        placeholder="1"
        value={fields.floor}
        onChange={setField("floor")}
        error={errors.floor}
      />

      {submitError && <p className="text-sm text-danger">{submitError}</p>}

      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Registrar impresora"}
      </Button>
    </form>
  );
}
