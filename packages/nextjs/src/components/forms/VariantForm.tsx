"use client";

/**
 * VariantForm — Formulario reutilizable para crear y editar variantes.
 *
 * Cada variante tiene su propio nombre independiente.
 * Campos: Nombre, Color, Etiqueta (opcional), Stock, Imagen.
 */

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { useToast } from "@/hooks/useToast";

export interface VariantFormValues {
  name: string;
  color: string;
  variantLabel: string;
  stock: number;
  imageUrl: string;
}

interface VariantFormProps {
  isEdit?: boolean;
  initialValues?: Partial<VariantFormValues>;
  onSubmit: (values: VariantFormValues) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const IMAGE_ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export function VariantForm({
  isEdit = false,
  initialValues = {},
  onSubmit,
  onCancel,
  loading = false,
}: VariantFormProps) {
  const { addToast } = useToast();

  const [name, setName] = useState(initialValues.name ?? "");
  const [color, setColor] = useState(initialValues.color ?? "");
  const [variantLabel, setVariantLabel] = useState(initialValues.variantLabel ?? "");
  const [stock, setStock] = useState(String(initialValues.stock ?? 50));
  const [imageUrl, setImageUrl] = useState(initialValues.imageUrl ?? "");
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialValues.imageUrl || null,
  );
  const [uploading, setUploading] = useState(false);

  const handleImageFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const localUrl = URL.createObjectURL(file);
      setImagePreview(localUrl);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/shop/images", { method: "POST", body: formData });
      const body = await res.json();

      if (!res.ok) throw new Error(body.error ?? "Error al subir imagen");

      setImageUrl(body.url);
      addToast("Imagen subida correctamente", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al subir imagen", "danger");
      setImagePreview(null);
      setImageUrl("");
    } finally {
      setUploading(false);
    }
  }, [addToast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      addToast("El nombre es obligatorio", "danger");
      return;
    }
    if (!color.trim()) {
      addToast("El color es obligatorio", "danger");
      return;
    }

    const parsedStock = Number(stock);
    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      addToast("El stock debe ser un entero no negativo", "danger");
      return;
    }

    await onSubmit({
      name: name.trim(),
      color: color.trim(),
      variantLabel: variantLabel.trim(),
      stock: parsedStock,
      imageUrl: imageUrl.trim(),
    });
  }

  const effectiveImageUrl = imagePreview ?? imageUrl;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nombre de la variante"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        placeholder="Ej: Taza UCM Negra 370ml"
        required
      />

      <Input
        label="Etiqueta (opcional)"
        value={variantLabel}
        onChange={(e) => setVariantLabel(e.currentTarget.value)}
        placeholder="Ej: Edición especial"
      />

      {/* Layout: [Color + Stock] | [Imagen] */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <Input
            label="Color"
            value={color}
            onChange={(e) => setColor(e.currentTarget.value)}
            placeholder="Ej: azul-marino, rojo, blanco"
            required
          />
          <Input
            label="Stock"
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.currentTarget.value)}
            required
          />
        </div>

        <div className="col-span-1 flex flex-col">
          <label className="text-sm font-medium text-text mb-1.5">Imagen</label>
          {effectiveImageUrl ? (
            <div className="relative flex-1 min-h-[120px] rounded-lg border border-border-default overflow-hidden bg-primary/5">
              <img
                src={effectiveImageUrl}
                alt="Preview"
                className="h-full w-full object-contain p-2"
              />
              <button
                type="button"
                onClick={() => {
                  setImageUrl("");
                  setImagePreview(null);
                }}
                className="absolute top-1 right-1 rounded-full bg-card/80 p-1 text-text-muted hover:text-danger transition-colors cursor-pointer"
                aria-label="Quitar imagen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex-1 min-h-[120px]">
              <FileDropZone
                onFile={handleImageFile}
                accept={IMAGE_ACCEPT}
                maxSize={5 * 1024 * 1024}
                label={uploading ? "Subiendo..." : "Imagen"}
                hint="JPG, PNG, WebP"
                className="h-full"
                onError={(msg) => addToast(msg, "danger")}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" loading={loading || uploading}>
          {isEdit ? "Guardar cambios" : "Crear variante"}
        </Button>
      </div>
    </form>
  );
}
