"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input, Select, Textarea } from "@/components/ui";

export interface PrintRequestFormData {
  printerId: string;
  filename: string;
  pages: string;
  copies: string;
  notes: string;
}

interface PrintRequestFormProps {
  onSubmit: (data: PrintRequestFormData) => Promise<void> | void;
  printers: { value: string; label: string }[];
}

export function PrintRequestForm({ onSubmit, printers }: PrintRequestFormProps) {
  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<PrintRequestFormData>({
    initialValues: { printerId: "", filename: "", pages: "", copies: "1", notes: "" },
    validate: (v) => {
      const e: Partial<Record<keyof PrintRequestFormData, string>> = {};
      if (!v.printerId) e.printerId = "Selecciona una impresora";
      if (!v.filename) e.filename = "El nombre del archivo es obligatorio";
      const pages = parseInt(v.pages);
      if (isNaN(pages) || pages < 1) e.pages = "Mínimo 1 página";
      const copies = parseInt(v.copies);
      if (isNaN(copies) || copies < 1) e.copies = "Mínimo 1 copia";
      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Select
        label="Impresora"
        options={printers}
        value={fields.printerId}
        onChange={setField("printerId")}
        error={errors.printerId}
        placeholder="Selecciona impresora"
      />
      <Input
        label="Nombre del archivo"
        placeholder="Ej: practica3.pdf"
        value={fields.filename}
        onChange={setField("filename")}
        error={errors.filename}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Páginas"
          type="number"
          min="1"
          placeholder="10"
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
      <Textarea
        label="Notas (opcional)"
        placeholder="Instrucciones adicionales..."
        value={fields.notes}
        onChange={setField("notes")}
      />
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        Solicitar impresión
      </Button>
    </form>
  );
}
