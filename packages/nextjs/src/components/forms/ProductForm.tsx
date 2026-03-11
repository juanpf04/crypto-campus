"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input, Textarea } from "@/components/ui";

export interface ProductFormData {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: string;
}

interface ProductFormProps {
  onSubmit: (data: ProductFormData) => Promise<void> | void;
  initialValues?: Partial<ProductFormData>;
  isEdit?: boolean;
}

export function ProductForm({ onSubmit, initialValues, isEdit }: ProductFormProps) {
  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<ProductFormData>({
    initialValues: {
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      price: initialValues?.price ?? "",
      stock: initialValues?.stock ?? "",
      category: initialValues?.category ?? "",
    },
    validate: (v) => {
      const e: Partial<Record<keyof ProductFormData, string>> = {};
      if (!v.name) e.name = "El nombre es obligatorio";
      const price = parseInt(v.price);
      if (isNaN(price) || price < 1) e.price = "El precio debe ser al menos 1 ShopToken";
      const stock = parseInt(v.stock);
      if (isNaN(stock) || stock < 0) e.stock = "El stock no puede ser negativo";
      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nombre del producto"
        placeholder="Ej: Cuaderno CryptoCampus"
        value={fields.name}
        onChange={setField("name")}
        error={errors.name}
      />
      <Textarea
        label="Descripción"
        placeholder="Descripción del producto"
        value={fields.description}
        onChange={setField("description")}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Precio (ShopTokens)"
          type="number"
          min="1"
          placeholder="10"
          value={fields.price}
          onChange={setField("price")}
          error={errors.price}
        />
        <Input
          label="Stock"
          type="number"
          min="0"
          placeholder="50"
          value={fields.stock}
          onChange={setField("stock")}
          error={errors.stock}
        />
      </div>
      <Input
        label="Categoría"
        placeholder="Ej: Papelería, Merchandising..."
        value={fields.category}
        onChange={setField("category")}
      />
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Añadir producto"}
      </Button>
    </form>
  );
}
