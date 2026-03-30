"use client";

/**
 * Añadir nueva variante a un grupo existente.
 * Usa VariantForm con isEdit=false.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { VariantForm, type VariantFormValues } from "@/components/forms/VariantForm";

export default function AddVariantPage() {
  const { id: groupKey } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupPrice, setGroupPrice] = useState(0);

  useEffect(() => {
    fetch(`/api/shop/products/groups/${groupKey}`)
      .then((r) => {
        if (!r.ok) throw new Error("No encontrado");
        return r.json();
      })
      .then((data) => {
        setGroupName(data.name);
        setGroupPrice(data.minPrice);
      })
      .catch(() => addToast("Error al cargar grupo", "danger"))
      .finally(() => setLoading(false));
  }, [groupKey, addToast]);

  async function handleSubmit(values: VariantFormValues) {
    setSaving(true);
    try {
      const res = await fetch(`/api/shop/products/groups/${groupKey}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          color: values.color,
          variantLabel: values.variantLabel || undefined,
          stock: values.stock,
          imageUrl: values.imageUrl || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error al crear variante");
      }

      addToast("Variante creada correctamente", "success");
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
        <Card className="w-full max-w-lg space-y-6">
          <div>
            <h1 className="text-xl font-bold text-text">Añadir variante</h1>
            <p className="text-sm text-text-muted mt-1">
              Añadir un nuevo color a <strong>{groupName}</strong>
            </p>
            <div className="mt-2">
              <Badge variant="info">Precio heredado: {groupPrice} ShopTokens</Badge>
            </div>
          </div>

          <VariantForm
            isEdit={false}
            initialValues={{ stock: 50 }}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/dashboard/admin/shop/products/${groupKey}`)}
            loading={saving}
          />
        </Card>
      </div>
    </div>
  );
}
