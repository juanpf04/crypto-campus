"use client";

/**
 * Gestión de productos de la tienda (admin).
 *
 * Tabla con todos los productos (activos e inactivos).
 * Acciones: editar, desactivar/reactivar.
 * Mismo patrón que admin/printing/printers.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

interface Product {
  id: string;
  productId: number;
  name: string;
  price: number;
  stock: number;
  category: string | null;
  active: boolean;
}

export default function AdminProductsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/shop/products/admin")
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => addToast("Error al cargar productos", "danger"))
      .finally(() => setLoading(false));
  }, []);

  async function toggleActive(product: Product) {
    const method = product.active ? "DELETE" : "PATCH";
    try {
      const res = await fetch(`/api/shop/products/${product.id}`, { method });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error al actualizar");
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, active: !p.active } : p)),
      );
      addToast(
        product.active ? "Producto desactivado" : "Producto reactivado",
        "success",
      );
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
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
      <BackLink href="/dashboard/admin/shop" label="Volver a tienda" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Productos</h1>
          <p className="text-text-muted mt-1">
            {products.length} producto(s) registrados.
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/admin/shop/products/new")}>
          Añadir producto
        </Button>
      </div>

      {products.length === 0 ? (
        <EmptyState
          title="Sin productos"
          description="Aún no hay productos en la tienda."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="text-text-muted text-sm">
                    #{product.productId}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-text-muted">
                    {product.category ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-primary">{product.price} SHPT</span>
                  </TableCell>
                  <TableCell>{product.stock}</TableCell>
                  <TableCell>
                    <Badge variant={product.active ? "success" : "neutral"}>
                      {product.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/admin/shop/products/${product.id}/edit`)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant={product.active ? "danger" : "primary"}
                        size="sm"
                        onClick={() => toggleActive(product)}
                      >
                        {product.active ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
