"use client";

/**
 * Historial de pedidos del estudiante.
 *
 * Dos pestañas:
 * - "Tickets": batches agrupados + filtro por estado (Entregado/Parc. devuelto/Devuelto)
 * - "Artículos": orders individuales + filtro por estado (Entregado/Devuelto)
 *
 * Filtro local (sin re-fetch). Se resetea al cambiar de tab.
 * Tabs a la izquierda, filtro a la derecha (misma fila).
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { LinkArrow } from "@/components/shared/LinkArrow";
import { BatchStatusBadge } from "@/components/shared/BatchStatusBadge";
import { ORDER_STATUS_MAP } from "@/lib/shop-constants";
import { formatShortDate, formatItemSummary } from "@/lib/formatters";

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

// ── Opciones de filtro ──

const BATCH_STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "DELIVERED", label: "Entregados" },
  { value: "PARTIALLY_RETURNED", label: "Parcialmente devueltos" },
  { value: "RETURNED", label: "Devueltos" },
];

const ORDER_STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "DELIVERED", label: "Entregados" },
  { value: "RETURNED", label: "Devueltos" },
];

const PAGE_SIZE = 10;

export default function StudentOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const initialTab = searchParams.get("tab") === "items" ? "items" : "batches";
  const [tab, setTab] = useState(initialTab);
  const [batchStatusFilter, setBatchStatusFilter] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("");

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
  }, [batchOffset, addToast]);

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
  }, [orderOffset, addToast]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Filtrado local
  const filteredBatches = useMemo(() => {
    if (!batchStatusFilter) return batches;
    return batches.filter((b) => b.generalStatus === batchStatusFilter);
  }, [batches, batchStatusFilter]);

  const filteredOrders = useMemo(() => {
    if (!orderStatusFilter) return orders;
    return orders.filter((o) => o.status === orderStatusFilter);
  }, [orders, orderStatusFilter]);

  const isLoading = tab === "batches" ? batchLoading : orderLoading;

  return (
    <div className="space-y-6">
      <BackLink href="/student/shop" label="Volver a la tienda" />

      <div>
        <h1 className="text-2xl font-bold text-text">Mis pedidos</h1>
        <p className="text-text-muted mt-1">
          Historial de todas tus compras en la tienda.
        </p>
      </div>

      {/* Tabs + filtro en la misma fila */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs
          tabs={[
            { value: "batches", label: "Tickets", count: batchTotal },
            { value: "items", label: "Artículos", count: orderTotal },
          ]}
          value={tab}
          onChange={(newTab) => {
            setTab(newTab);
            // Resetear filtros al cambiar de tab
            if (newTab === "batches") setOrderStatusFilter("");
            if (newTab === "items") setBatchStatusFilter("");
          }}
        />

        {/* Filtro de estado */}
        <div className="w-56">
          {tab === "batches" ? (
            <Select
              value={batchStatusFilter}
              onChange={(e) => setBatchStatusFilter(e.currentTarget.value)}
              options={BATCH_STATUS_OPTIONS}
            />
          ) : (
            <Select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.currentTarget.value)}
              options={ORDER_STATUS_OPTIONS}
            />
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <Skeleton className="h-10 w-56" />
          <SkeletonTable columns={5} rows={8} />
        </div>
      ) : tab === "batches" ? (
        /* ── Pestaña Tickets ── */
        filteredBatches.length === 0 ? (
          <EmptyState
            title="Sin pedidos"
            description={batchStatusFilter ? "No hay tickets con ese estado." : "Aún no has realizado ninguna compra."}
          />
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
                  {filteredBatches.map((batch) => {
                    const summary = formatItemSummary(batch.items);

                    return (
                      <TableRow
                        key={batch.id}
                        className="cursor-pointer hover:bg-primary/5 transition-colors"
                        onClick={() => router.push(`/student/shop/orders/batch/${batch.id}`)}
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
        /* ── Pestaña Artículos ── */
        filteredOrders.length === 0 ? (
          <EmptyState
            title="Sin artículos"
            description={orderStatusFilter ? "No hay artículos con ese estado." : "Aún no has realizado ninguna compra."}
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
                  {filteredOrders.map((order) => {
                    const status = ORDER_STATUS_MAP[order.status] ?? ORDER_STATUS_MAP.PAID;
                    return (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-primary/5 transition-colors"
                        onClick={() => router.push(`/student/shop/orders/${order.id}?from=items`)}
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
