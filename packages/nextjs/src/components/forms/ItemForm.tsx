"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input, Select, Textarea } from "@/components/ui";

export interface ItemFormData {
  title: string;
  type: string;
  creator: string;
  description: string;
  category: string;
  physicalLocation: string;
  physicalCondition: string;
  totalCopies: string;
  isbn: string;
  publisher: string;
  year: string;
  pages: string;
  players: string;
  duration: string;
  ageRating: string;
  platform: string;
  genre: string;
}

interface ItemFormProps {
  onSubmit: (data: ItemFormData) => Promise<void> | void;
  initialValues?: Partial<ItemFormData>;
  isEdit?: boolean;
}

const typeOptions = [
  { value: "BOOK", label: "Libro" },
  { value: "BOARD_GAME", label: "Juego de mesa" },
  { value: "VIDEO_GAME", label: "Videojuego" },
  { value: "OTHER", label: "Otro" },
];

const conditionOptions = [
  { value: "Nuevo", label: "Nuevo" },
  { value: "Bueno", label: "Bueno" },
  { value: "Aceptable", label: "Aceptable" },
  { value: "Deteriorado", label: "Deteriorado" },
];

const defaultValues: ItemFormData = {
  title: "", type: "BOOK", creator: "", description: "", category: "",
  physicalLocation: "", physicalCondition: "Bueno", totalCopies: "1",
  isbn: "", publisher: "", year: "", pages: "",
  players: "", duration: "", ageRating: "",
  platform: "", genre: "",
};

export function ItemForm({ onSubmit, initialValues, isEdit }: ItemFormProps) {
  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<ItemFormData>({
    initialValues: { ...defaultValues, ...initialValues },
    validate: (v) => {
      const e: Partial<Record<keyof ItemFormData, string>> = {};
      if (!v.title) e.title = "El título es obligatorio";
      if (!v.type) e.type = "Selecciona un tipo";
      const copies = parseInt(v.totalCopies);
      if (isNaN(copies) || copies < 1) e.totalCopies = "Mínimo 1 copia";
      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Título"
        placeholder="Ej: El Señor de los Anillos"
        value={fields.title}
        onChange={setField("title")}
        error={errors.title}
      />
      <Select
        label="Tipo"
        options={typeOptions}
        value={fields.type}
        onChange={setField("type")}
        error={errors.type}
        disabled={isEdit}
      />
      <Input
        label="Autor / Diseñador / Estudio"
        placeholder="Ej: J.R.R. Tolkien"
        value={fields.creator}
        onChange={setField("creator")}
      />
      <Textarea
        label="Descripción"
        placeholder="Descripción opcional"
        value={fields.description}
        onChange={setField("description")}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Categoría"
          placeholder="Ej: Programación, Estrategia..."
          value={fields.category}
          onChange={setField("category")}
        />
        <Input
          label="Copias disponibles"
          type="number"
          min="1"
          value={fields.totalCopies}
          onChange={setField("totalCopies")}
          error={errors.totalCopies}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Ubicación física"
          placeholder="Ej: 2ª planta, Estantería 4B"
          value={fields.physicalLocation}
          onChange={setField("physicalLocation")}
        />
        <Select
          label="Estado físico"
          options={conditionOptions}
          value={fields.physicalCondition}
          onChange={setField("physicalCondition")}
        />
      </div>

      {/* --- Campos dinámicos según tipo --- */}

      {fields.type === "BOOK" && (
        <div className="grid grid-cols-2 gap-4">
          <Input label="ISBN" placeholder="Ej: 978-84-376-0494-7" value={fields.isbn} onChange={setField("isbn")} />
          <Input label="Editorial" placeholder="Ej: Anaya" value={fields.publisher} onChange={setField("publisher")} />
          <Input label="Año" type="number" placeholder="Ej: 2024" value={fields.year} onChange={setField("year")} />
          <Input label="Páginas" type="number" placeholder="Ej: 320" value={fields.pages} onChange={setField("pages")} />
        </div>
      )}

      {fields.type === "BOARD_GAME" && (
        <div className="grid grid-cols-3 gap-4">
          <Input label="Jugadores" placeholder="Ej: 2-4" value={fields.players} onChange={setField("players")} />
          <Input label="Duración (min)" placeholder="Ej: 60" value={fields.duration} onChange={setField("duration")} />
          <Input label="Edad mínima" placeholder="Ej: 12+" value={fields.ageRating} onChange={setField("ageRating")} />
        </div>
      )}

      {fields.type === "VIDEO_GAME" && (
        <div className="grid grid-cols-2 gap-4">
          <Input label="Plataforma" placeholder="Ej: PS5, Switch, PC" value={fields.platform} onChange={setField("platform")} />
          <Input label="Género" placeholder="Ej: RPG, Puzzle" value={fields.genre} onChange={setField("genre")} />
        </div>
      )}

      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Añadir ítem"}
      </Button>
    </form>
  );
}
