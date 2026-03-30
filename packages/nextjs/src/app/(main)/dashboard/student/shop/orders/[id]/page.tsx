"use client";

/**
 * Detalle de un pedido del estudiante.
 *
 * Muestra toda la información del pedido: producto, precio, fechas,
 * estado, txHash. Si el pedido está entregado y dentro de 30 días,
 * permite solicitar devolución.
 */

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
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
    id: string;
    name: string;
    description: string | null;
    price: number;
    category: string | null;
    imageUrl: string | null;
  };
}


export default function StudentOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  // BackLink inteligente: si viene de un batch, volver al batch; si de items, volver a la tab de artículos
  const from = searchParams.get("from");
  const batchId = searchParams.get("batchId");
  const backHref = from === "batch" && batchId
    ? `/dashboard/student/shop/orders/batch/${batchId}`
    : "/dashboard/student/shop/orders?tab=items";
  const backLabel = from === "batch" ? "Volver al pedido" : "Volver a artículos";

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returning, setReturning] = useState(false);

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
  }, [id]);

  // Calcular si se puede devolver (DELIVERED + dentro de 30 días)
  const canReturn = order?.status === "DELIVERED" && order.deliveryDate
    ? (Date.now() - new Date(order.deliveryDate).getTime()) / (1000 * 60 * 60 * 24) <= 30
    : false;

  // Días restantes para devolver
  const daysLeft = order?.deliveryDate
    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(order.deliveryDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  async function handleReturn() {
    if (!order) return;
    setReturning(true);

    try {
      const res = await fetch(`/api/shop/orders/${order.id}/return`, { method: "PUT" });
      const data = await res.json();

      if (!res.ok) {
        addToast(data.error ?? "Error al procesar la devolución", "danger");
        return;
      }

      addToast("Devolución procesada correctamente. Se han reembolsado tus ShopTokens.", "success");
      setOrder({ ...order, status: "RETURNED", returnDate: new Date().toISOString() });
    } catch {
      addToast("Error al procesar la devolución", "danger");
    } finally {
      setReturning(false);
      setShowReturnModal(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
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

  return (
    <div className="space-y-6">
      <BackLink href={backHref} label={backLabel} />

      <div>
        <h1 className="text-2xl font-bold text-text">Detalle del pedido</h1>
        <p className="text-text-muted mt-1">
          Pedido realizado el {formatDateTime(order.purchaseDate)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Columna izquierda: Producto */}
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

        {/* Columna derecha: Ficha del pedido */}
        <Card className="space-y-5">
          <h3 className="text-sm font-semibold text-text border-b border-border-default pb-3">
            Información del pedido
          </h3>

          <div className="space-y-3">
            <DetailField
              label="Estado"
              value={<Badge variant={status.variant}>{status.label}</Badge>}
            />
            <DetailField
              label="Precio pagado"
              value={<span className="font-bold text-primary">{order.pricePaid} ShopTokens</span>}
            />
            <DetailField label="Fecha de compra" value={formatDateTime(order.purchaseDate)} />
            {order.deliveryDate && (
              <DetailField label="Fecha de entrega" value={formatDateTime(order.deliveryDate)} />
            )}
            {order.returnDate && (
              <DetailField label="Fecha de devolución" value={formatDateTime(order.returnDate)} />
            )}
          </div>

          {/* Botón de devolución */}
          {canReturn && (
            <>
              <div className="border-t border-border-default" />
              <div className="space-y-2">
                <p className="text-xs text-text-muted">
                  Tienes {daysLeft} {daysLeft === 1 ? "día" : "días"} restantes para solicitar la devolución.
                </p>
                <Button
                  variant="danger"
                  onClick={() => setShowReturnModal(true)}
                  className="w-full"
                >
                  Solicitar devolución
                </Button>
              </div>
            </>
          )}

          {order.status === "DELIVERED" && !canReturn && (
            <>
              <div className="border-t border-border-default" />
              <p className="text-xs text-text-muted">
                El plazo de devolución de 30 días ha expirado.
              </p>
            </>
          )}
        </Card>
      </div>

      {/* Modal de confirmación de devolución */}
      <ConfirmModal
        open={showReturnModal}
        title="Confirmar devolución"
        description={`¿Seguro que quieres devolver "${order.product.name}"? Se te reembolsarán ${order.pricePaid} ShopTokens.`}
        confirmLabel="Sí, devolver"
        onConfirm={handleReturn}
        onClose={() => setShowReturnModal(false)}
        loading={returning}
      />
    </div>
  );
}
