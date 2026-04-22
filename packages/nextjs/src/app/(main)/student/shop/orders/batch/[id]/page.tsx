"use client";

/**
 * Detalle de un pedido agrupado (batch) para el estudiante.
 *
 * Page fina: carga el batch y compone OrderBatchDetailView (student mode)
 * + card de recibo al final.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import {
  OrderBatchDetailView,
  type BatchDetailPayload,
} from "@/components/dashboard/OrderBatchDetailView";
import { formatShortDate, calculateOrderStats } from "@/lib/formatters";

export default function StudentBatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [batch, setBatch] = useState<BatchDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/shop/batches/${id}`);
      if (!res.ok) throw new Error("Error al cargar pedido");
      setBatch(await res.json());
    } catch {
      addToast("Error al cargar el pedido", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => { loadBatch(); }, [loadBatch]);

  async function handleReturn(orderIds: string[]) {
    try {
      for (const orderId of orderIds) {
        const res = await fetch(`/api/shop/orders/${orderId}/return`, { method: "PUT" });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "Error al devolver");
        }
      }
      addToast(
        orderIds.length === 1
          ? "Artículo devuelto correctamente"
          : `${orderIds.length} artículos devueltos correctamente`,
        "success",
      );
      await loadBatch();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    }
  }

  if (loading) return <SkeletonPage />;

  if (!batch) {
    return (
      <div className="space-y-6">
        <BackLink href="/student/shop/orders" label="Volver a pedidos" />
        <p className="text-text-muted">Pedido no encontrado.</p>
      </div>
    );
  }

  const { returnedCount } = calculateOrderStats(batch.items);

  return (
    <div className="space-y-6 pb-20">
      <BackLink href="/student/shop/orders" label="Volver a pedidos" />

      <OrderBatchDetailView
        batch={batch}
        mode="student"
        onReturn={handleReturn}
        onNavigateToOrder={(orderId) =>
          router.push(`/student/shop/orders/${orderId}?from=batch&batchId=${batch.id}`)
        }
      />

      <Card className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">Fecha de compra</span>
          <span className="text-text">{formatShortDate(batch.purchaseDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Nº de recibo</span>
          <span className="text-text">#{batch.batchId}</span>
        </div>
        {returnedCount > 0 && (
          <div className="flex justify-between">
            <span className="text-text-muted">Reembolsado</span>
            <span className="text-danger font-semibold">
              {batch.items.filter((i) => i.status === "RETURNED").reduce((sum, i) => sum + i.pricePaid, 0)} ShopTokens
            </span>
          </div>
        )}
        <p className="text-xs text-text-muted pt-2 border-t border-border-default mt-2">
          Tienes 30 días desde la entrega para devolver un artículo.
        </p>
      </Card>
    </div>
  );
}
