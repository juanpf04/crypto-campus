"use client";

/**
 * Editar variante individual de un producto.
 * Usa VariantForm con isEdit=true.
 *
 * Query params:
 * - from=detail → redirige al detalle del grupo
 * - from=list → redirige al listado de productos
 * - group=slug → groupKey para redirección y cargar template
 */

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { VariantForm, type VariantFormValues } from "@/components/forms/VariantForm";

export default function EditVariantPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const from = searchParams.get("from") ?? "detail";
  const groupKey = searchParams.get("group") ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialValues, setInitialValues] = useState<Partial<VariantFormValues>>({});
  const [productId, setProductId] = useState<number | null>(null);
  const [active, setActive] = useState(true);

  function getBackUrl() {
    if (from === "list") return "/admin/shop/products";
    if (groupKey) return `/admin/shop/products/${groupKey}`;
    return "/admin/shop/products";
  }

  useEffect(() => {
    fetch(`/api/shop/products/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("No encontrado");
        return r.json();
      })
      .then((data) => {
        setInitialValues({
          name: data.name ?? "",
          color: data.color ?? "",
          variantLabel: data.variantLabel ?? "",
          stock: data.stock ?? 0,
          imageUrl: data.imageUrl ?? "",
        });
        setProductId(data.productId ?? null);
        setActive(data.active ?? true);
      })
      .catch(() => addToast("Error al cargar variante", "danger"))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  async function handleSubmit(values: VariantFormValues) {
    setSaving(true);
    try {
      const res = await fetch(`/api/shop/products/variants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          color: values.color || undefined,
          variantLabel: values.variantLabel || undefined,
          stock: values.stock,
          imageUrl: values.imageUrl || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error al guardar");
      }

      addToast("Variante actualizada correctamente", "success");
      router.push(getBackUrl());
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
      <BackLink href={getBackUrl()} label="Volver" />

      <div className="flex min-h-full items-start justify-center pt-8">
        <Card className="w-full max-w-lg space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-text">Editar variante</h1>
              {productId !== null && <Badge variant="neutral">#{productId}</Badge>}
              <Badge variant={active ? "success" : "danger"}>
                {active ? "Activa" : "Inactiva"}
              </Badge>
            </div>
            <p className="text-sm text-text-muted">
              Edita los campos de esta variante. El nombre se genera automáticamente a partir del color y el template del grupo.
            </p>
          </div>

          <VariantForm
            isEdit
            initialValues={initialValues}

            onSubmit={handleSubmit}
            onCancel={() => router.push(getBackUrl())}
            loading={saving}
          />
        </Card>
      </div>
    </div>
  );
}
