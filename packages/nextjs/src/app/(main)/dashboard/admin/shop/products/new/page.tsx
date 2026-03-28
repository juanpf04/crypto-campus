"use client";

/**
 * Crear nuevo producto (grupo + primera variante).
 * Usa ProductGroupForm con isEdit=false.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { ProductGroupForm, type ProductGroupFormValues } from "@/components/forms/ProductGroupForm";

export default function AdminNewProductPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(values: ProductGroupFormValues) {
    setSaving(true);
    try {
      const res = await fetch("/api/shop/products/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          description: values.description || undefined,
          category: values.category || undefined,
          price: values.price,
          stock: values.stock,
          color: values.color,
          imageUrl: values.imageUrl || undefined,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al crear producto");

      addToast("Producto creado correctamente", "success");
      router.push(`/dashboard/admin/shop/products/${body.groupKey}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/admin/shop/products" label="Volver a productos" />

      <div className="flex min-h-full items-start justify-center pt-8">
        <Card className="w-full max-w-2xl space-y-6">
          <div>
            <h1 className="text-xl font-bold text-text">Nuevo producto</h1>
            <p className="text-sm text-text-muted mt-1">
              Crea un nuevo grupo de producto con su primera variante de color.
              Después podrás añadir más variantes desde el detalle.
            </p>
          </div>

          <ProductGroupForm
            isEdit={false}
            onSubmit={handleSubmit}
            onCancel={() => router.push("/dashboard/admin/shop/products")}
            loading={saving}
          />
        </Card>
      </div>
    </div>
  );
}
