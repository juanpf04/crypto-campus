"use client";

/**
 * Historial de pedidos del estudiante.
 *
 * Tabla paginada con todos los pedidos del usuario:
 * producto, fecha, precio, estado. Filas clicables al detalle.
 * Mismo patrón que el historial de impresiones.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";
import { LinkArrow } from "@/components/shared/LinkArrow";
import { ORDER_STATUS_MAP } from "@/lib/shop-constants";
import { formatShortDate } from "@/lib/formatters";

interface Order {
  id: string;
  orderId: number;
  pricePaid: number;
  status: "PAID" | "DELIVERED" | "RETURNED";
  purchaseDate: string;
  product: {
    name: string;
    imageUrl: string | null;
    category: string | null;
  };
}

const PAGE_SIZE = 10;

export default function StudentOrdersPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/shop/orders?limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    } catch {
      addToast("Error al cargar pedidos", "danger");
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/student/shop" label="Volver a la tienda" />

      <div>
        <h1 className="text-2xl font-bold text-text">Mis pedidos</h1>
        <p className="text-text-muted mt-1">
          Historial de todas tus compras en la tienda.
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Sin pedidos"
          description="Aún no has realizado ninguna compra."
        />
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const status = ORDER_STATUS_MAP[order.status] ?? ORDER_STATUS_MAP.PAID;
                  return (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-primary/5 transition-colors"
                      onClick={() => router.push(`/dashboard/student/shop/orders/${order.id}`)}
                    >
                      <TableCell className="text-text-muted text-sm whitespace-nowrap">
                        {formatShortDate(order.purchaseDate)}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {order.product.name}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-primary">{order.pricePaid} ShopTokens</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <LinkArrow variant="static" size="sm" className="relative right-auto top-auto" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            total={total}
            onChange={setOffset}
          />
        </>
      )}
    </div>
  );
}
