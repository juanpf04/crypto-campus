"use client";

/**
 * Crear un nuevo producto de la tienda (admin).
 * Mismo patrón que admin/printing/printers/new: BackLink + Card centrada + Form.
 */

import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { ProductForm, type ProductFormData } from "@/components/forms/ProductForm";

export default function AdminNewProductPage() {
  const router = useRouter();
  const { addToast } = useToast();

  async function handleSubmit(data: ProductFormData) {
    const res = await fetch("/api/shop/products", {
      method: "POST",
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
    if (!res.ok) throw new Error(body.error ?? "Error al crear producto");

    addToast("Producto creado correctamente", "success");
    router.push("/dashboard/admin/shop/products");
  }

  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-lg space-y-6">
        <BackLink href="/dashboard/admin/shop/products" label="Volver a productos" />
        <Card>
          <CardHeader>
            <CardTitle>Nuevo producto</CardTitle>
          </CardHeader>
          <CardBody>
            <ProductForm onSubmit={handleSubmit} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
