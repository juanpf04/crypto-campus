"use client";

/**
 * Editar grupo de producto — campos compartidos.
 * Usa ProductGroupForm con isEdit=true.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { ProductGroupForm, type ProductGroupFormValues } from "@/components/forms/ProductGroupForm";

export default function EditGroupPage() {
  const { id: groupKey } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialValues, setInitialValues] = useState<Partial<ProductGroupFormValues>>({});
  const [variantCount, setVariantCount] = useState(0);

  useEffect(() => {
    fetch(`/api/shop/products/groups/${groupKey}`)
      .then((r) => {
        if (!r.ok) throw new Error("No encontrado");
        return r.json();
      })
      .then((data) => {
        setInitialValues({
          name: data.name,
          description: data.description ?? "",
          category: data.category ?? "",
          price: data.minPrice,
        });
        setVariantCount(data.variants.length);
      })
      .catch(() => addToast("Error al cargar grupo", "danger"))
      .finally(() => setLoading(false));
  }, [groupKey, addToast]);

  async function handleSubmit(values: ProductGroupFormValues) {
    setSaving(true);
    try {
      const res = await fetch(`/api/shop/products/groups/${groupKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          description: values.description || undefined,
          category: values.category || undefined,
          price: values.price,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error al guardar");
      }

      addToast("Grupo actualizado correctamente", "success");
      router.push(`/dashboard/admin/shop/products/${groupKey}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink
        href={`/dashboard/admin/shop/products/${groupKey}`}
        label="Volver al detalle"
      />

      <div className="flex min-h-full items-start justify-center pt-8">
        <Card className="w-full max-w-2xl space-y-6">
          <div>
            <h1 className="text-xl font-bold text-text">Editar grupo</h1>
            <p className="text-sm text-text-muted mt-1">
              Los cambios se aplican a las {variantCount} variante{variantCount !== 1 ? "s" : ""} del grupo.
            </p>
          </div>

          <ProductGroupForm
            isEdit
            initialValues={initialValues}
            variantCount={variantCount}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/dashboard/admin/shop/products/${groupKey}`)}
            loading={saving}
          />
        </Card>
      </div>
    </div>
  );
}
