"use client";

/**
 * Detalle de un artículo pedido para el admin.
 *
 * Igual que la vista del estudiante pero con:
 * - Datos blockchain (txHash, orderId on-chain)
 * - Info del usuario
 * - Devolución sin límite de tiempo
 * - Acción de entregar si está en PAID
 */

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { DetailField } from "@/components/shared/DetailField";
import { ProductImage } from "@/components/shared/ProductImage";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { ORDER_STATUS_MAP } from "@/lib/shop-constants";
import { formatDateTime } from "@/lib/formatters";

interface OrderDetail {
  id: string;
  orderId: number;
  pricePaid: number;
  status: "PAID" | "DELIVERED" | "RETURNED";
  txHash: string;
  purchaseDate: string;
  deliveryDate: string | null;
  returnDate: string | null;
  product: {
    name: string;
    description: string | null;
    price: number;
    category: string | null;
    imageUrl: string | null;
  };
  user?: {
    name: string;
    email: string;
  };
}

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const from = searchParams.get("from");
  const batchId = searchParams.get("batchId");
  const backHref = from === "batch" && batchId
    ? `/dashboard/admin/shop/orders/batch/${batchId}`
    : "/dashboard/admin/shop/orders?tab=items";
  const backLabel = from === "batch" ? "Volver al pedido" : "Volver a artículos";

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/shop/orders/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("No se pudo cargar el pedido");
        return r.json();
      })
      .then(setOrder)
      .catch((err) => addToast(err.message, "danger"))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  async function handleDeliver() {
    if (!order) return;
    setActing(true);
    try {
      const res = await fetch(`/api/shop/orders/${order.id}/deliver`, { method: "PUT" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      addToast("Artículo marcado como entregado", "success");
      setOrder({ ...order, status: "DELIVERED", deliveryDate: new Date().toISOString() });
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setActing(false);
    }
  }

  async function handleReturn() {
    if (!order) return;
    setActing(true);
    try {
      const res = await fetch(`/api/shop/orders/${order.id}/return`, { method: "PUT" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      addToast("Devolución procesada correctamente", "success");
      setOrder({ ...order, status: "RETURNED", returnDate: new Date().toISOString() });
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setActing(false);
      setShowReturnModal(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <BackLink href={backHref} label={backLabel} />
        <p className="text-text-muted">Pedido no encontrado.</p>
      </div>
    );
  }

  const status = ORDER_STATUS_MAP[order.status] ?? ORDER_STATUS_MAP.PAID;
  const canDeliver = order.status === "PAID";
  const canReturn = order.status === "PAID" || order.status === "DELIVERED";

  return (
    <div className="space-y-6">
      <BackLink href={backHref} label={backLabel} />

      <div>
        <h1 className="text-2xl font-bold text-text">Detalle del artículo</h1>
        <p className="text-text-muted mt-1">
          Pedido realizado el {formatDateTime(order.purchaseDate)}
          {order.user && <> por <strong>{order.user.name}</strong> ({order.user.email})</>}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Producto */}
        <Card className="flex flex-col items-center justify-center p-8 space-y-4">
          <ProductImage
            imageUrl={order.product.imageUrl}
            name={order.product.name}
            category={order.product.category}
            emojiSize="lg"
          />
          <div className="text-center">
            <h2 className="text-lg font-semibold text-text">{order.product.name}</h2>
            {order.product.category && (
              <Badge variant="neutral" className="mt-1">{order.product.category}</Badge>
            )}
          </div>
        </Card>

        {/* Ficha */}
        <Card className="space-y-5">
          <h3 className="text-sm font-semibold text-text border-b border-border-default pb-3">
            Información del pedido
          </h3>

          <div className="space-y-3">
            <DetailField label="Estado" value={<Badge variant={status.variant}>{status.label}</Badge>} />
            <DetailField label="Precio pagado" value={<span className="font-bold text-primary">{order.pricePaid} ShopTokens</span>} />
            <DetailField label="Fecha de compra" value={formatDateTime(order.purchaseDate)} />
            {order.deliveryDate && <DetailField label="Fecha de entrega" value={formatDateTime(order.deliveryDate)} />}
            {order.returnDate && <DetailField label="Fecha de devolución" value={formatDateTime(order.returnDate)} />}
          </div>

          {/* Datos blockchain (solo admin) */}
          <div className="border-t border-border-default" />
          <div className="space-y-3">
            <DetailField label="Tx Hash" value={
              <span className="font-mono text-xs text-text-muted">{order.txHash}</span>
            } />
            <DetailField label="ID on-chain" value={`#${order.orderId}`} />
          </div>

          {/* Acciones */}
          {(canDeliver || canReturn) && (
            <>
              <div className="border-t border-border-default" />
              <div className="flex gap-3">
                {canDeliver && (
                  <Button className="flex-1" onClick={handleDeliver} loading={acting}>
                    Marcar como entregado
                  </Button>
                )}
                {canReturn && (
                  <Button variant="danger" className="flex-1" onClick={() => setShowReturnModal(true)}>
                    Procesar devolución
                  </Button>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      <ConfirmModal
        open={showReturnModal}
        title="Confirmar devolución"
        description={`¿Procesar devolución de "${order.product.name}"? Se reembolsarán ${order.pricePaid} ShopTokens al usuario.`}
        confirmLabel="Procesar devolución"
        onConfirm={handleReturn}
        onClose={() => setShowReturnModal(false)}
        loading={acting}
      />
    </div>
  );
}
