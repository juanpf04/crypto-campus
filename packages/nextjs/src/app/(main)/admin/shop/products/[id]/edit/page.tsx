"use client";

/**
 * Editar un producto (admin).
 *
 * Carga el grupo completo de variantes. Al guardar, aplica los cambios
 * compartidos (nombre base, descripción, categoría, precio, stock) a
 * TODAS las variantes del grupo. Así no puedes tener el boli rojo a 20
 * y el azul a 10.
 *
 * Navegación inteligente: ?from=detail → vuelve al detalle,
 * ?from=list → vuelve al listado.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { ProductForm, type ProductFormData } from "@/components/forms/ProductForm";

interface ProductVariant {
  id: string;
  name: string;
  price: number;
  stock: number;
  color: string;
}

interface ProductGroup {
  groupKey: string;
  name: string;
  category: string | null;
  description: string | null;
  minPrice: number;
  totalStock: number;
  active: boolean;
  variants: ProductVariant[];
}

export default function AdminEditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const [group, setGroup] = useState<ProductGroup | null>(null);
  const [loading, setLoading] = useState(true);

  const from = searchParams.get("from");
  const backUrl = from === "detail"
    ? `/admin/shop/products/${id}`
    : "/admin/shop/products";
  const backLabel = from === "detail" ? "Volver al detalle" : "Volver a productos";

  // Cargar el grupo que contiene esta variante
  useEffect(() => {
    if (!id) return;

    fetch("/api/shop/products/admin")
      .then((r) => r.json())
      .then((groups: ProductGroup[]) => {
        if (!Array.isArray(groups)) return;
        const matched = groups.find((g) =>
          g.variants.some((v) => v.id === id),
        );
        if (matched) setGroup(matched);
      })
      .catch(() => addToast("Error al cargar producto", "danger"))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  async function handleSubmit(data: ProductFormData) {
    if (!group) return;

    const price = parseInt(data.price, 10);
    const stock = parseInt(data.stock, 10);

    // Actualizar TODAS las variantes del grupo con los datos compartidos
    const results = await Promise.all(
      group.variants.map((v) =>
        fetch(`/api/shop/products/${v.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            description: data.description || undefined,
            price,
            stock,
            category: data.category || undefined,
          }),
        }),
      ),
    );

    const allOk = results.every((r) => r.ok);
    if (!allOk) {
      throw new Error("Error al actualizar algunas variantes del grupo");
    }

    addToast(
      `${group.name} actualizado (${group.variants.length} variante${group.variants.length > 1 ? "s" : ""})`,
      "success",
    );
    router.push(backUrl);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="space-y-6">
        <BackLink href={backUrl} label={backLabel} />
        <p className="text-text-muted">Producto no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-lg space-y-6">
        <BackLink href={backUrl} label={backLabel} />
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Editar producto</CardTitle>
              {group.variants.length > 1 && (
                <Badge variant="info">
                  {group.variants.length} variantes
                </Badge>
              )}
            </div>
            {group.variants.length > 1 && (
              <p className="text-xs text-text-muted mt-1">
                Los cambios de nombre, precio, stock y categoría se aplicarán a todas las variantes del grupo.
              </p>
            )}
          </CardHeader>
          <CardBody>
            <ProductForm
              onSubmit={handleSubmit}
              isEdit
              initialValues={{
                name: group.name,
                description: group.description ?? "",
                price: String(group.minPrice),
                stock: String(Math.round(group.totalStock / group.variants.length)),
                category: group.category ?? "",
                imageUrl: "",
              }}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
