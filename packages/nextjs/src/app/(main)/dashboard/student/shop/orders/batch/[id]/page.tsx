"use client";

/**
 * Detalle de un pedido agrupado (batch) para el estudiante.
 *
 * Muestra:
 * - Header: fecha, txHash, total, estado general
 * - Lista de artículos con estado individual y botón "Devolver" por artículo
 * - Resumen: X de Y artículos entregados, Z devueltos
 *
 * Compone: BackLink, Card, Badge (atómicos) +
 *          BatchStatusBadge, OrderItemRow, DetailField (intermedios)
 */

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
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
  items: BatchOrderItem[];
}

export default function StudentBatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState<string | null>(null);

  const loadBatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/shop/batches/${id}`);
      if (!res.ok) throw new Error("Error al cargar pedido");
      const data = await res.json();
      setBatch(data);
    } catch {
      addToast("Error al cargar el pedido", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => { loadBatch(); }, [loadBatch]);

  // Devolver un artículo individual
  async function handleReturn(orderPrismaId: string) {
    setReturning(orderPrismaId);
    try {
      const res = await fetch(`/api/shop/orders/${orderPrismaId}/return`, {
        method: "PUT",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error al devolver");
      }
      addToast("Artículo devuelto correctamente", "success");
      await loadBatch();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setReturning(null);
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
        <BackLink href="/dashboard/student/shop/orders" label="Volver a pedidos" />
        <p className="text-text-muted">Pedido no encontrado.</p>
      </div>
    );
  }

  const deliveredCount = batch.items.filter((i) => i.status === "DELIVERED").length;
  const returnedCount = batch.items.filter((i) => i.status === "RETURNED").length;
  const paidCount = batch.items.filter((i) => i.status === "PAID").length;

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/student/shop/orders" label="Volver a pedidos" />

      {/* Header del pedido */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-text">Pedido #{batch.batchId}</h1>
            <BatchStatusBadge status={batch.generalStatus} />
          </div>
          <p className="text-sm text-text-muted">
            {formatShortDate(batch.purchaseDate)} &middot; {batch.items.length} artículo{batch.items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">{batch.totalPaid} ShopTokens</p>
        </div>
      </div>

      {/* Resumen de estado */}
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

      {/* Lista de artículos */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Artículos del pedido</SectionTitle>

        <Card className="overflow-hidden p-0 divide-y divide-border-default">
          {batch.items.map((item) => {
            // Solo se puede devolver si está entregado
            const canReturn = item.status === "DELIVERED";
            // Verificar si está dentro del periodo de devolución (30 días)
            const withinWindow = item.deliveryDate
              ? (Date.now() - new Date(item.deliveryDate).getTime()) < 30 * 24 * 60 * 60 * 1000
              : false;

            return (
              <OrderItemRow
                key={item.id}
                name={item.product.name}
                imageUrl={item.product.imageUrl}
                category={item.product.category}
                color={item.product.color}
                variantLabel={item.product.variantLabel}
                pricePaid={item.pricePaid}
                status={item.status}
                actionLabel={canReturn && withinWindow ? "Devolver" : undefined}
                actionVariant="danger"
                onAction={canReturn && withinWindow ? () => handleReturn(item.id) : undefined}
                actionLoading={returning === item.id}
              />
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
