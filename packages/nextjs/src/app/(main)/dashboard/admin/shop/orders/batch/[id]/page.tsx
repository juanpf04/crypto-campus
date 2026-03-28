"use client";

/**
 * Detalle de un pedido agrupado (batch) para el admin.
 *
 * Mismo layout que el del estudiante pero con acciones de admin:
 * - Marcar entregado individual / todos
 * - Procesar devolución (sin límite de 30 días)
 * - Info del usuario
 *
 * Compone: BackLink, Card, Button (atómicos) +
 *          BatchStatusBadge, OrderItemRow, DetailField, SectionTitle (intermedios)
 */

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { BatchStatusBadge } from "@/components/shared/BatchStatusBadge";
import { OrderItemRow } from "@/components/shared/OrderItemRow";
import { DetailField } from "@/components/shared/DetailField";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { icons } from "@/components/ui/icons";
import { formatShortDate } from "@/lib/formatters";

interface BatchOrderItem {
  id: string;
  orderId: number;
  pricePaid: number;
  status: "PAID" | "DELIVERED" | "RETURNED";
  purchaseDate: string;
  deliveryDate: string | null;
  returnDate: string | null;
  product: {
    name: string;
    imageUrl: string | null;
    category: string | null;
    color: string | null;
    variantLabel: string | null;
  };
}

interface BatchDetail {
  id: string;
  batchId: number;
  totalPaid: number;
  txHash: string;
  purchaseDate: string;
  generalStatus: string;
  user: { name: string; email: string };
  items: BatchOrderItem[];
}

export default function AdminBatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

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

  // Marcar todos como entregados
  async function handleDeliverAll() {
    setActing("all");
    try {
      const res = await fetch(`/api/shop/batches/${id}`, { method: "PUT" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error");
      }
      addToast("Todos los artículos marcados como entregados", "success");
      await loadBatch();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setActing(null);
    }
  }

  // Marcar individual como entregado
  async function handleDeliverItem(orderPrismaId: string) {
    setActing(orderPrismaId);
    try {
      const res = await fetch(`/api/shop/orders/${orderPrismaId}/deliver`, { method: "PUT" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error");
      }
      addToast("Artículo marcado como entregado", "success");
      await loadBatch();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setActing(null);
    }
  }

  // Procesar devolución (admin, sin límite de tiempo)
  async function handleReturnItem(orderPrismaId: string) {
    setActing(`return-${orderPrismaId}`);
    try {
      const res = await fetch(`/api/shop/orders/${orderPrismaId}/return`, { method: "PUT" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error");
      }
      addToast("Devolución procesada", "success");
      await loadBatch();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="space-y-6">
        <BackLink href="/dashboard/admin/shop/orders" label="Volver a pedidos" />
        <p className="text-text-muted">Pedido no encontrado.</p>
      </div>
    );
  }

  const paidCount = batch.items.filter((i) => i.status === "PAID").length;
  const deliveredCount = batch.items.filter((i) => i.status === "DELIVERED").length;
  const returnedCount = batch.items.filter((i) => i.status === "RETURNED").length;

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/admin/shop/orders" label="Volver a pedidos" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-text">Pedido #{batch.batchId}</h1>
            <BatchStatusBadge status={batch.generalStatus} />
          </div>
          <p className="text-sm text-text-muted">
            {batch.user.name} ({batch.user.email}) &middot; {formatShortDate(batch.purchaseDate)} &middot; {batch.items.length} artículo{batch.items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-2xl font-bold text-primary">{batch.totalPaid} ShopTokens</p>
          {paidCount > 0 && (
            <Button onClick={handleDeliverAll} loading={acting === "all"}>
              Entregar todo ({paidCount})
            </Button>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-warning">{paidCount}</p>
          <p className="text-xs text-text-muted mt-1">Pendientes</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-success">{deliveredCount}</p>
          <p className="text-xs text-text-muted mt-1">Entregados</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-danger">{returnedCount}</p>
          <p className="text-xs text-text-muted mt-1">Devueltos</p>
        </Card>
      </div>

      {/* Artículos */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Artículos del pedido</SectionTitle>

        <Card className="overflow-hidden p-0 divide-y divide-border-default">
          {batch.items.map((item) => {
            const canDeliver = item.status === "PAID";
            const canReturn = item.status === "PAID" || item.status === "DELIVERED";

            // Admin: determinar qué acción mostrar
            let actionLabel: string | undefined;
            let actionVariant: "primary" | "danger" | "outline" = "primary";
            let onAction: (() => void) | undefined;
            let actionLoading = false;

            if (canDeliver) {
              actionLabel = "Entregar";
              actionVariant = "primary";
              onAction = () => handleDeliverItem(item.id);
              actionLoading = acting === item.id;
            }

            return (
              <div key={item.id} className="flex items-center">
                <div className="flex-1">
                  <OrderItemRow
                    name={item.product.name}
                    imageUrl={item.product.imageUrl}
                    category={item.product.category}
                    color={item.product.color}
                    variantLabel={item.product.variantLabel}
                    pricePaid={item.pricePaid}
                    status={item.status}
                    actionLabel={actionLabel}
                    actionVariant={actionVariant}
                    onAction={onAction}
                    actionLoading={actionLoading}
                  />
                </div>
                {canReturn && (
                  <div className="pr-4">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleReturnItem(item.id)}
                      loading={acting === `return-${item.id}`}
                    >
                      Devolver
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      </section>

      {/* Detalles técnicos */}
      <Card className="space-y-3">
        <DetailField label="Hash de transacción" value={
          <span className="font-mono text-xs break-all">{batch.txHash}</span>
        } />
        <DetailField label="Fecha de compra" value={formatShortDate(batch.purchaseDate)} />
        <DetailField label="ID on-chain" value={`Batch #${batch.batchId}`} />
      </Card>
    </div>
  );
}
