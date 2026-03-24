"use client";

/**
 * Formulario para crear o editar un producto de la tienda.
 *
 * Campos: nombre, descripción, precio (SHPT), stock, categoría e imagen (URL).
 * Reutilizado en /admin/shop/products/new y .../[id]/edit.
 */

import { useForm } from "@/hooks/useForm";
import { Button, Input, Textarea, Select } from "@/components/ui";

export interface ProductFormData {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: string;
  imageUrl: string;
}

interface ProductFormProps {
  onSubmit: (data: ProductFormData) => Promise<void> | void;
  initialValues?: Partial<ProductFormData>;
  isEdit?: boolean;
}

const CATEGORIES = [
  { value: "", label: "Sin categoría" },
  { value: "Papelería", label: "Papelería" },
  { value: "Ropa", label: "Ropa" },
  { value: "Accesorios", label: "Accesorios" },
  { value: "Tecnología", label: "Tecnología" },
];

export function ProductForm({ onSubmit, initialValues, isEdit }: ProductFormProps) {
  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<ProductFormData>({
    initialValues: {
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      price: initialValues?.price ?? "",
      stock: initialValues?.stock ?? "",
      category: initialValues?.category ?? "",
      imageUrl: initialValues?.imageUrl ?? "",
    },
    validateOnChange: true,
    validate: (v) => {
      const e: Partial<Record<keyof ProductFormData, string>> = {};
      if (!v.name.trim()) e.name = "El nombre es obligatorio";
      const price = parseInt(v.price, 10);
      if (!v.price.trim()) e.price = "El precio es obligatorio";
      else if (isNaN(price) || price <= 0) e.price = "El precio debe ser al menos 1 ShopToken";
      const stock = parseInt(v.stock, 10);
      if (!v.stock.trim()) e.stock = "El stock es obligatorio";
      else if (isNaN(stock) || stock < 0) e.stock = "El stock no puede ser negativo";
      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nombre del producto"
        placeholder="Camiseta UCM Blanca"
        value={fields.name}
        onChange={setField("name")}
        error={errors.name}
      />
      <Textarea
        label="Descripción (opcional)"
        placeholder="Camiseta 100% algodón con el escudo de la UCM"
        value={fields.description}
        onChange={setField("description")}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Precio (SHPT)"
          type="number"
          min="1"
          value={fields.price}
          onChange={setField("price")}
          error={errors.price}
        />
        <Input
          label="Stock"
          type="number"
          min="0"
          value={fields.stock}
          onChange={setField("stock")}
          error={errors.stock}
        />
      </div>
      <Select
        label="Categoría"
        value={fields.category}
        onChange={setField("category")}
        options={CATEGORIES}
      />
      <Input
        label="URL de imagen (opcional)"
        placeholder="/images/shop/camiseta.png"
        value={fields.imageUrl}
        onChange={setField("imageUrl")}
      />
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Añadir producto"}
      </Button>
    </form>
  );
}
