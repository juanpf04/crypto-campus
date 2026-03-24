"use client";

/**
 * Editar un producto existente (admin).
 * Carga los datos actuales y los pasa como initialValues al ProductForm.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { ProductForm, type ProductFormData } from "@/components/forms/ProductForm";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: string | null;
  imageUrl: string | null;
}

export default function AdminEditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/shop/products/${id}`)
      .then((r) => r.json())
      .then(setProduct)
      .catch(() => addToast("Error al cargar producto", "danger"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(data: ProductFormData) {
    const res = await fetch(`/api/shop/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        description: data.description || undefined,
        price: parseInt(data.price, 10),
        stock: parseInt(data.stock, 10),
        category: data.category || undefined,
        imageUrl: data.imageUrl || undefined,
      }),
    });

    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Error al actualizar producto");

    addToast("Producto actualizado correctamente", "success");
    router.push("/dashboard/admin/shop/products");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <BackLink href="/dashboard/admin/shop/products" label="Volver a productos" />
        <p className="text-text-muted">Producto no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-lg space-y-6">
        <BackLink href="/dashboard/admin/shop/products" label="Volver a productos" />
        <Card>
          <CardHeader>
            <CardTitle>Editar producto</CardTitle>
          </CardHeader>
          <CardBody>
            <ProductForm
              onSubmit={handleSubmit}
              isEdit
              initialValues={{
                name: product.name,
                description: product.description ?? "",
                price: String(product.price),
                stock: String(product.stock),
                category: product.category ?? "",
                imageUrl: product.imageUrl ?? "",
              }}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
