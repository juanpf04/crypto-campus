"use client";

/**
 * Historial de pedidos del estudiante.
 *
 * Dos pestañas:
 * - "Pedidos": batches agrupados (1 compra = 1 fila con N artículos)
 * - "Artículos": orders individuales (vista plana tradicional)
 *
 * Ambas con paginación. Filas clicables al detalle.
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
import { Tabs } from "@/components/ui/Tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { LinkArrow } from "@/components/shared/LinkArrow";
import { BatchStatusBadge } from "@/components/shared/BatchStatusBadge";
import { ORDER_STATUS_MAP } from "@/lib/shop-constants";
import { formatShortDate } from "@/lib/formatters";

// ── Tipos ──

interface OrderItem {
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

interface BatchItem {
  id: string;
  status: string;
  product: { name: string };
}

interface Batch {
  id: string;
  batchId: number;
  totalPaid: number;
  txHash: string;
  purchaseDate: string;
  generalStatus: string;
  items: BatchItem[];
}

const PAGE_SIZE = 10;

export default function StudentOrdersPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [tab, setTab] = useState("batches");

  // Batches
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchOffset, setBatchOffset] = useState(0);
  const [batchLoading, setBatchLoading] = useState(true);

  // Orders individuales
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderOffset, setOrderOffset] = useState(0);
  const [orderLoading, setOrderLoading] = useState(true);

  // Cargar batches
  const fetchBatches = useCallback(async () => {
    setBatchLoading(true);
    try {
      const res = await fetch(`/api/shop/batches?limit=${PAGE_SIZE}&offset=${batchOffset}`);
      const data = await res.json();
      setBatches(data.batches ?? []);
      setBatchTotal(data.total ?? 0);
    } catch {
      addToast("Error al cargar pedidos", "danger");
    } finally {
      setBatchLoading(false);
    }
  }, [batchOffset]);

  // Cargar orders
  const fetchOrders = useCallback(async () => {
    setOrderLoading(true);
    try {
      const res = await fetch(`/api/shop/orders?limit=${PAGE_SIZE}&offset=${orderOffset}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
      setOrderTotal(data.total ?? 0);
    } catch {
      addToast("Error al cargar artículos", "danger");
    } finally {
      setOrderLoading(false);
    }
  }, [orderOffset]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const isLoading = tab === "batches" ? batchLoading : orderLoading;

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/student/shop" label="Volver a la tienda" />

      <div>
        <h1 className="text-2xl font-bold text-text">Mis pedidos</h1>
        <p className="text-text-muted mt-1">
          Historial de todas tus compras en la tienda.
        </p>
      </div>

      <Tabs
        tabs={[
          { value: "batches", label: "Pedidos", count: batchTotal },
          { value: "items", label: "Artículos", count: orderTotal },
        ]}
        value={tab}
        onChange={setTab}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : tab === "batches" ? (
        /* ── Pestaña Pedidos (batches) ── */
        batches.length === 0 ? (
          <EmptyState title="Sin pedidos" description="Aún no has realizado ninguna compra." />
        ) : (
          <>
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Artículos</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => {
                    const itemNames = batch.items.map((i) => i.product.name);
                    const summary = itemNames.length <= 2
                      ? itemNames.join(", ")
                      : `${itemNames[0]} y ${itemNames.length - 1} más`;

                    return (
                      <TableRow
                        key={batch.id}
                        className="cursor-pointer hover:bg-primary/5 transition-colors"
                        onClick={() => router.push(`/dashboard/student/shop/orders/batch/${batch.id}`)}
                      >
                        <TableCell className="text-text-muted text-sm whitespace-nowrap">
                          {formatShortDate(batch.purchaseDate)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-text truncate max-w-[250px]">{summary}</p>
                            <p className="text-xs text-text-muted">{batch.items.length} artículo{batch.items.length !== 1 ? "s" : ""}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-primary">{batch.totalPaid} ShopTokens</span>
                        </TableCell>
                        <TableCell>
                          <BatchStatusBadge status={batch.generalStatus} />
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
              offset={batchOffset}
              limit={PAGE_SIZE}
              total={batchTotal}
              onChange={setBatchOffset}
            />
          </>
        )
      ) : (
        /* ── Pestaña Artículos (orders sueltos) ── */
        orders.length === 0 ? (
          <EmptyState title="Sin artículos" description="Aún no has realizado ninguna compra." />
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
              offset={orderOffset}
              limit={PAGE_SIZE}
              total={orderTotal}
              onChange={setOrderOffset}
            />
          </>
        )
      )}
    </div>
  );
}
