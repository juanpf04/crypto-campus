"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input, Textarea } from "@/components/ui";

export interface RoomFormData {
  name: string;
  description: string;
  location: string;
  capacity: string;
  amenityProjector: boolean;
  amenityWhiteboard: boolean;
  amenityPowerOutlets: boolean;
  amenityAirConditioning: boolean;
}

interface RoomFormProps {
  onSubmit: (data: RoomFormData) => Promise<void> | void;
  initialValues?: Partial<RoomFormData>;
  isEdit?: boolean;
}

const defaultValues: RoomFormData = {
  name: "",
  description: "",
  location: "",
  capacity: "4",
  amenityProjector: false,
  amenityWhiteboard: false,
  amenityPowerOutlets: false,
  amenityAirConditioning: false,
};

export function RoomForm({ onSubmit, initialValues, isEdit }: RoomFormProps) {
  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<RoomFormData>({
    initialValues: { ...defaultValues, ...initialValues },
    validate: (v) => {
      const e: Partial<Record<keyof RoomFormData, string>> = {};
      if (!v.name) e.name = "El nombre es obligatorio";
      const cap = parseInt(v.capacity);
      if (isNaN(cap) || cap < 1) e.capacity = "Mínimo 1 persona";
      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input
        label="Nombre de la sala"
        placeholder="Ej: Sala de Estudio A"
        value={fields.name}
        onChange={setField("name")}
        error={errors.name}
      />
      <Textarea
        label="Descripción"
        placeholder="Descripción opcional"
        value={fields.description}
        onChange={setField("description")}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Ubicación"
          placeholder="Ej: Planta 2, ala norte"
          value={fields.location}
          onChange={setField("location")}
        />
        <Input
          label="Capacidad (personas)"
          type="number"
          min="1"
          value={fields.capacity}
          onChange={setField("capacity")}
          error={errors.capacity}
        />
      </div>

      {/* Amenidades */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-muted">Equipamiento</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "amenityProjector" as const, label: "Proyector" },
            { key: "amenityWhiteboard" as const, label: "Pizarra" },
            { key: "amenityPowerOutlets" as const, label: "Enchufes" },
            { key: "amenityAirConditioning" as const, label: "Aire acondicionado" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-text cursor-pointer">
              <input
                type="checkbox"
                checked={fields[key]}
                onChange={(e) => setField(key)(e as unknown as React.ChangeEvent<HTMLInputElement>)}
                className="rounded border-border-default"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Crear sala"}
      </Button>
    </form>
  );
}
