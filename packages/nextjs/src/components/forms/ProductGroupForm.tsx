"use client";

/**
 * ProductGroupForm — Formulario reutilizable para crear y editar grupos de producto.
 *
 * En modo creación: incluye los campos de la primera variante (color, stock, imagen).
 * En modo edición: solo los campos compartidos del grupo (nombre, desc, categoría, precio).
 *
 * Layout compacto:
 * - Grupo: [Nombre | Descripción] + [Categoría (combo) | Precio]
 * - Variante: [Color / Stock] | [FileDropZone imagen]
 */

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { useToast } from "@/hooks/useToast";

export interface ProductGroupFormValues {
  name: string;
  description: string;
  category: string;
  price: number;
  variantName?: string;
  color?: string;
  stock?: number;
  imageUrl?: string;
}

interface ProductGroupFormProps {
  isEdit?: boolean;
  initialValues?: Partial<ProductGroupFormValues>;
  variantCount?: number;
  onSubmit: (values: ProductGroupFormValues) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const IMAGE_ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const CUSTOM_CATEGORY_VALUE = "__custom__";

export function ProductGroupForm({
  isEdit = false,
  initialValues = {},
  variantCount = 0,
  onSubmit,
  onCancel,
  loading = false,
}: ProductGroupFormProps) {
  const { addToast } = useToast();

  // name se mantiene internamente para edición (no se muestra en el formulario)
  const [description, setDescription] = useState(initialValues.description ?? "");
  const [category, setCategory] = useState(initialValues.category ?? "");
  const [customCategory, setCustomCategory] = useState("");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [price, setPrice] = useState(String(initialValues.price ?? ""));
  const [categories, setCategories] = useState<string[]>([]);

  // Solo creación:
  const [variantName, setVariantName] = useState(initialValues.variantName ?? "");
  const [color, setColor] = useState(initialValues.color ?? "");
  const [stock, setStock] = useState(String(initialValues.stock ?? 50));
  const [imageUrl, setImageUrl] = useState(initialValues.imageUrl ?? "");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Cargar categorías existentes
  useEffect(() => {
    fetch("/api/shop/categories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(() => { /* silencioso */ });
  }, []);

  // Detectar si la categoría inicial es custom (no está en la lista)
  useEffect(() => {
    if (initialValues.category && categories.length > 0) {
      if (!categories.includes(initialValues.category)) {
        setIsCustomCategory(true);
        setCustomCategory(initialValues.category);
        setCategory(CUSTOM_CATEGORY_VALUE);
      }
    }
  }, [categories, initialValues.category]);

  function handleCategoryChange(value: string) {
    if (value === CUSTOM_CATEGORY_VALUE) {
      setIsCustomCategory(true);
      setCategory(CUSTOM_CATEGORY_VALUE);
    } else {
      setIsCustomCategory(false);
      setCustomCategory("");
      setCategory(value);
    }
  }

  // Upload de imagen
  const handleImageFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      // Preview local inmediata
      const localUrl = URL.createObjectURL(file);
      setImagePreview(localUrl);

      // Upload al servidor
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

    const finalCategory = isCustomCategory ? customCategory.trim() : category;
    if (!finalCategory) {
      addToast("La categoría es obligatoria", "danger");
      return;
    }

    const parsedPrice = Number(price);
    if (!Number.isInteger(parsedPrice) || parsedPrice <= 0) {
      addToast("El precio debe ser un entero positivo", "danger");
      return;
    }

    if (!isEdit) {
      if (!variantName.trim()) {
        addToast("El nombre de la variante es obligatorio", "danger");
        return;
      }
      if (!color.trim()) {
        addToast("El color de la primera variante es obligatorio", "danger");
        return;
      }
      const parsedStock = Number(stock);
      if (!Number.isInteger(parsedStock) || parsedStock < 0) {
        addToast("El stock debe ser un entero no negativo", "danger");
        return;
      }

      await onSubmit({
        name: "",
        description: description.trim(),
        category: finalCategory,
        price: parsedPrice,
        variantName: variantName.trim(),
        color: color.trim(),
        stock: parsedStock,
        imageUrl: imageUrl.trim() || undefined,
      });
    } else {
      await onSubmit({
        name: "",
        description: description.trim(),
        category: finalCategory,
        price: parsedPrice,
      });
    }
  }

  const effectiveImageUrl = imagePreview ?? imageUrl;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Datos del grupo ── */}
      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
        Datos del producto
      </h3>

      <Input
        label="Descripción"
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
        placeholder="Descripción breve del producto"
      />

      {/* Fila 2: Categoría (combo) | Precio */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Select
            label="Categoría"
            value={isCustomCategory ? CUSTOM_CATEGORY_VALUE : category}
            onChange={(e) => handleCategoryChange(e.currentTarget.value)}
            placeholder="Selecciona categoría"
            options={[
              ...categories.map((cat) => ({ value: cat, label: cat })),
              { value: CUSTOM_CATEGORY_VALUE, label: "Otra (escribir)..." },
            ]}
            required
          />
          {isCustomCategory && (
            <Input
              value={customCategory}
              onChange={(e) => setCustomCategory(e.currentTarget.value)}
              placeholder="Escribe la nueva categoría"
              required
            />
          )}
        </div>

        <Input
          label="Precio (ShopTokens)"
          type="number"
          min={1}
          value={price}
          onChange={(e) => setPrice(e.currentTarget.value)}
          required
        />
      </div>

      {isEdit && variantCount > 1 && (
        <p className="text-xs text-text-muted">
          El precio se actualizará on-chain para las {variantCount} variantes.
        </p>
      )}

      {/* ── Primera variante (solo creación) ── */}
      {!isEdit && (
        <>
          <hr className="border-border-default" />

          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
            Primera variante
          </h3>

          <Input
            label="Nombre de la variante"
            value={variantName}
            onChange={(e) => setVariantName(e.currentTarget.value)}
            placeholder="Ej: Taza UCM Negra 370ml"
            required
          />

          <div className="grid grid-cols-3 gap-4">
            {/* Columna izquierda (2/3): Color + Stock */}
            <div className="col-span-2 space-y-4">
              <Input
                label="Color"
                value={color}
                onChange={(e) => setColor(e.currentTarget.value)}
                placeholder="Ej: azul, negro, blanco"
                required
              />
              <Input
                label="Stock inicial"
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(e.currentTarget.value)}
                required
              />
            </div>

            {/* Columna derecha (1/3): Imagen */}
            <div className="col-span-1 flex flex-col">
              <label className="text-sm font-medium text-text mb-1.5">Imagen</label>
              {effectiveImageUrl ? (
                <div className="relative flex-1 min-h-[120px] rounded-lg border border-border-default overflow-hidden bg-primary/5">
                  <Image
                    src={effectiveImageUrl}
                    alt="Preview"
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 33vw"
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
        </>
      )}

      {/* ── Botones ── */}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" loading={loading || uploading}>
          {isEdit ? "Guardar cambios" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}
