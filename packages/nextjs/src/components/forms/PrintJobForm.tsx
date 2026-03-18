"use client";

/**
 * Formulario para ejecutar un trabajo de impresión.
 *
 * El usuario selecciona la impresora (dropdown con las activas),
 * introduce el nombre del archivo, número de páginas y copias.
 * Reutilizable para estudiantes y para el admin (en nombre de otro).
 */

import { useForm } from "@/hooks/useForm";
import { Button, Input, Select } from "@/components/ui";

export interface PrintJobFormData {
  printerId: string;
  filename: string;
  pages: string;
  copies: string;
}

interface Printer {
  id: string;
  name: string;
  location: string;
}

interface PrintJobFormProps {
  /** Lista de impresoras activas para el dropdown */
  printers: Printer[];
  onSubmit: (data: PrintJobFormData) => Promise<void> | void;
  /** Texto del botón de submit (default "Imprimir") */
  submitLabel?: string;
}

export function PrintJobForm({ printers, onSubmit, submitLabel = "Imprimir" }: PrintJobFormProps) {
  const printerOptions = printers.map((p) => ({
    value: p.id,
    label: `${p.name} — ${p.location}`,
  }));

  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<PrintJobFormData>({
    initialValues: {
      printerId: "",
      filename: "",
      pages: "",
      copies: "1",
    },
    validateOnChange: true,
    validate: (v) => {
      const e: Partial<Record<keyof PrintJobFormData, string>> = {};

      if (!v.printerId) e.printerId = "Selecciona una impresora";
      if (!v.filename.trim()) e.filename = "El nombre del archivo es obligatorio";

      const pages = Number(v.pages);
      if (!v.pages || !Number.isInteger(pages) || pages < 1) {
        e.pages = "Introduce un número de páginas válido";
      }

      const copies = Number(v.copies);
      if (!v.copies || !Number.isInteger(copies) || copies < 1) {
        e.copies = "Introduce un número de copias válido";
      }

      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Select
        label="Impresora"
        placeholder="Selecciona una impresora"
        options={printerOptions}
        value={fields.printerId}
        onChange={setField("printerId")}
        error={errors.printerId}
      />
      <Input
        label="Nombre del archivo"
        placeholder="documento.pdf"
        value={fields.filename}
        onChange={setField("filename")}
        error={errors.filename}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Páginas"
          type="number"
          min="1"
          placeholder="1"
          value={fields.pages}
          onChange={setField("pages")}
          error={errors.pages}
        />
        <Input
          label="Copias"
          type="number"
          min="1"
          placeholder="1"
          value={fields.copies}
          onChange={setField("copies")}
          error={errors.copies}
        />
      </div>

      {submitError && <p className="text-sm text-danger">{submitError}</p>}

      <Button type="submit" loading={loading}>
        {submitLabel}
      </Button>
    </form>
  );
}
