"use client";

/**
 * Gestión de pedidos de la tienda (admin).
 *
 * Tabla paginada con filtros por usuario y estado.
 * Acciones: marcar entregado, procesar devolución.
 * Mismo patrón que admin/printing/logs.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { LinkArrow } from "@/components/shared/LinkArrow";
import { ORDER_STATUS_MAP } from "@/lib/shop-constants";
import { formatShortDate } from "@/lib/formatters";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

interface Order {
  id: string;
  orderId: number;
  pricePaid: number;
  status: "PAID" | "DELIVERED" | "RETURNED";
  txHash: string;
  purchaseDate: string;
  product: { name: string };
  user: { id: string; name: string; email: string };
}

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "PAID", label: "Pagado" },
  { value: "DELIVERED", label: "Entregado" },
  { value: "RETURNED", label: "Devuelto" },
];

export default function AdminOrdersPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(`/api/shop/orders/admin?${params}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    } catch {
      addToast("Error al cargar pedidos", "danger");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [offset, filterStatus]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  async function handleDeliver(orderId: string) {
    try {
      const res = await fetch(`/api/shop/orders/${orderId}/deliver`, { method: "PUT" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error");
      }
      addToast("Pedido marcado como entregado", "success");
      fetchOrders();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    }
  }

  async function handleReturn(orderId: string) {
    try {
      const res = await fetch(`/api/shop/orders/${orderId}/return`, { method: "PUT" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error");
      }
      addToast("Devolución procesada correctamente", "success");
      fetchOrders();
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
          <h1 className="text-2xl font-bold text-text">Pedidos</h1>
          <p className="text-text-muted mt-1">
            Gestión de todos los pedidos del sistema.
          </p>
        </div>
        <div className="w-48">
          <Select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.currentTarget.value);
              setOffset(0);
            }}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Sin pedidos"
          description="No hay pedidos que coincidan con los filtros."
        />
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className={refreshing ? "opacity-50 transition-opacity" : ""}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tx Hash</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const status = ORDER_STATUS_MAP[order.status] ?? ORDER_STATUS_MAP.PAID;
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="text-text-muted text-sm whitespace-nowrap">
                          {formatShortDate(order.purchaseDate)}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="font-medium">{order.user.name}</span>
                          <br />
                          <span className="text-text-muted">{order.user.email}</span>
                        </TableCell>
                        <TableCell className="font-medium max-w-[150px] truncate">
                          {order.product.name}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-primary">{order.pricePaid} SHPT</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-text-muted">
                          {order.txHash.slice(0, 6)}…{order.txHash.slice(-4)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {order.status === "PAID" && (
                              <Button size="sm" onClick={() => handleDeliver(order.id)}>
                                Entregar
                              </Button>
                            )}
                            {(order.status === "PAID" || order.status === "DELIVERED") && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleReturn(order.id)}
                              >
                                Devolver
                              </Button>
                            )}
                            {order.status === "RETURNED" && (
                              <span className="text-xs text-text-muted">Completado</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
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
