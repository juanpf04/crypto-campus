"use client";

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
    validate: (v) => {
      const e: Partial<Record<keyof PrinterFormData, string>> = {};
      if (!v.id) e.id = "El identificador es obligatorio";
      if (!v.name) e.name = "El nombre es obligatorio";
      if (!v.location) e.location = "La ubicación es obligatoria";
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
        label="Nombre"
        placeholder="Ej: Impresora Biblioteca P2"
        value={fields.name}
        onChange={setField("name")}
        error={errors.name}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Ubicación"
          placeholder="Ej: Biblioteca, planta 2"
          value={fields.location}
          onChange={setField("location")}
          error={errors.location}
        />
        <Input
          label="Planta (opcional)"
          placeholder="Ej: 2"
          value={fields.floor}
          onChange={setField("floor")}
        />
      </div>
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Registrar impresora"}
      </Button>
    </form>
  );
}
