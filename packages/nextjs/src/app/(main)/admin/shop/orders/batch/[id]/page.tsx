"use client";

/**
 * Detalle de un pedido agrupado (batch) para el admin.
 *
 * Page fina: carga el batch y compone OrderBatchDetailView (admin mode)
 * + card adicional con datos blockchain (txHash, ID on-chain).
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { DetailField } from "@/components/shared/DetailField";
import {
  OrderBatchDetailView,
  type BatchDetailPayload,
} from "@/components/dashboard/OrderBatchDetailView";
import { formatShortDate } from "@/lib/formatters";

interface AdminBatchDetail extends BatchDetailPayload {
  txHash: string | null; // null en batches históricos (sin contraparte on-chain)
  user: { name: string; email: string };
  historical?: boolean;
}

export default function AdminBatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [batch, setBatch] = useState<AdminBatchDetail | null>(null);
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
        if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      }
      addToast(`${orderIds.length} devolución(es) procesada(s)`, "success");
      await loadBatch();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    }
  }

  async function handleDeliver(orderIds: string[]) {
    try {
      for (const orderId of orderIds) {
        const res = await fetch(`/api/shop/orders/${orderId}/deliver`, { method: "PUT" });
        if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      }
      addToast(`${orderIds.length} artículo(s) entregado(s)`, "success");
      await loadBatch();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    }
  }

  if (loading) return <SkeletonPage />;

  if (!batch) {
    return (
      <div className="space-y-6">
        <BackLink href="/admin/shop/orders" label="Volver a pedidos" />
        <p className="text-text-muted">Pedido no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <BackLink href="/admin/shop/orders" label="Volver a pedidos" />

      <OrderBatchDetailView
        batch={batch}
        mode="admin"
        onReturn={handleReturn}
        onDeliver={handleDeliver}
        onNavigateToOrder={(orderId) =>
          router.push(`/admin/shop/orders/${orderId}?from=batch&batchId=${batch.id}`)
        }
      />

      <Card className="space-y-3">
        <DetailField
          label="Hash de transacción"
          value={
            batch.txHash ? (
              <span className="font-mono text-xs break-all">{batch.txHash}</span>
            ) : (
              <span className="text-text-muted text-sm italic">
                Sin transacción on-chain (registro histórico)
              </span>
            )
          }
        />
        <DetailField label="Fecha de compra" value={formatShortDate(batch.purchaseDate)} />
        <DetailField
          label="ID on-chain"
          value={batch.batchId !== null && batch.batchId !== undefined ? `Batch #${batch.batchId}` : "—"}
        />
      </Card>
    </div>
  );
}
