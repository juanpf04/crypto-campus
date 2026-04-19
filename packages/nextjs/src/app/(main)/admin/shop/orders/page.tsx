"use client";

/**
 * Gestión de pedidos de la tienda (admin).
 *
 * Dos pestañas: "Pedidos" (batches) + "Artículos" (orders sueltos).
 * Filtro por usuario en ambas. Paginación.
 * Acciones: marcar entregado (individual/batch), procesar devolución.
 *
 * Compone: BackLink, Card, Select, Spinner, Tabs, Pagination, Badge (atómicos) +
 *          BatchStatusBadge, LinkArrow (intermedios) + Table (atómico).
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Tabs } from "@/components/ui/Tabs";
import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";
import { LinkArrow } from "@/components/shared/LinkArrow";
import { BatchStatusBadge } from "@/components/shared/BatchStatusBadge";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { ORDER_STATUS_MAP } from "@/lib/shop-constants";
import { formatShortDate, formatItemSummary } from "@/lib/formatters";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

// ── Tipos ──

interface OrderItem {
  id: string;
  orderId: number;
  pricePaid: number;
  status: "PAID" | "DELIVERED" | "RETURNED";
  txHash: string;
  purchaseDate: string;
  product: { name: string };
  user: { name: string; email: string };
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
  user: { name: string; email: string };
  items: BatchItem[];
}

interface UserOption {
  value: string;
  label: string;
}

const PAGE_SIZE = 20;

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

export default function AdminOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const initialTab = searchParams.get("tab") === "items" ? "items" : "batches";
  const [tab, setTab] = useState(initialTab);
  const [userFilter, setUserFilter] = useState("");
  const [batchStatusFilter, setBatchStatusFilter] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);

  // Batches
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchOffset, setBatchOffset] = useState(0);
  const [batchLoading, setBatchLoading] = useState(true);
  const [batchRefreshing, setBatchRefreshing] = useState(false);

  // Orders
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderOffset, setOrderOffset] = useState(0);
  const [orderLoading, setOrderLoading] = useState(true);
  const [orderRefreshing, setOrderRefreshing] = useState(false);

  // Modal de confirmación de devolución
  const [returnModal, setReturnModal] = useState<{ orderId: string; productName: string } | null>(null);
  const [returning, setReturning] = useState(false);

  // Cargar lista de usuarios para el filtro
  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.users;
        if (Array.isArray(list)) {
          setUsers(list.map((u: { id: string; name: string; email: string }) => ({
            value: u.id,
            label: `${u.name} (${u.email})`,
          })));
        }
      })
      .catch(() => {});
  }, []);

  // Cargar batches
  const fetchBatches = useCallback(async () => {
    setBatchRefreshing(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(batchOffset),
      });
      if (userFilter) params.set("userId", userFilter);

      const res = await fetch(`/api/shop/batches/admin?${params}`);
      const data = await res.json();
      setBatches(data.batches ?? []);
      setBatchTotal(data.total ?? 0);
    } catch {
      addToast("Error al cargar pedidos", "danger");
    } finally {
      setBatchLoading(false);
      setBatchRefreshing(false);
    }
  }, [batchOffset, userFilter, addToast]);

  // Cargar orders
  const fetchOrders = useCallback(async () => {
    setOrderRefreshing(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(orderOffset),
      });
      if (userFilter) params.set("userId", userFilter);

      const res = await fetch(`/api/shop/orders/admin?${params}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
      setOrderTotal(data.total ?? 0);
    } catch {
      addToast("Error al cargar artículos", "danger");
    } finally {
      setOrderLoading(false);
      setOrderRefreshing(false);
    }
  }, [orderOffset, userFilter, addToast]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Acciones
  async function handleDeliverItem(orderId: string) {
    try {
      const res = await fetch(`/api/shop/orders/${orderId}/deliver`, { method: "PUT" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error");
      }
      addToast("Artículo marcado como entregado", "success");
      fetchOrders();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    }
  }

  function handleReturnItem(orderId: string, productName: string) {
    setReturnModal({ orderId, productName });
  }

  async function confirmReturn() {
    if (!returnModal) return;
    setReturning(true);
    try {
      const res = await fetch(`/api/shop/orders/${returnModal.orderId}/return`, { method: "PUT" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error");
      }
      addToast("Devolución procesada", "success");
      setReturnModal(null);
      fetchOrders();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setReturning(false);
    }
  }

  // Filtrado local por estado
  const filteredBatches = useMemo(() => {
    if (!batchStatusFilter) return batches;
    return batches.filter((b) => b.generalStatus === batchStatusFilter);
  }, [batches, batchStatusFilter]);

  const filteredOrders = useMemo(() => {
    if (!orderStatusFilter) return orders;
    return orders.filter((o) => o.status === orderStatusFilter);
  }, [orders, orderStatusFilter]);

  const isLoading = tab === "batches" ? batchLoading : orderLoading;
  const isRefreshing = tab === "batches" ? batchRefreshing : orderRefreshing;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/shop" label="Volver a tienda" />

      <div>
        <h1 className="text-2xl font-bold text-text">Pedidos</h1>
        <p className="text-text-muted mt-1">Gestión de todos los pedidos del sistema.</p>
      </div>

      {/* Tabs + filtros en la misma fila */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs
          tabs={[
            { value: "batches", label: "Tickets", count: batchTotal },
            { value: "items", label: "Artículos", count: orderTotal },
          ]}
          value={tab}
          onChange={(newTab) => {
            setTab(newTab);
            if (newTab === "batches") setOrderStatusFilter("");
            if (newTab === "items") setBatchStatusFilter("");
          }}
        />

        <div className="flex gap-3">
          <div className="w-56">
            <Select
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.currentTarget.value);
                setBatchOffset(0);
                setOrderOffset(0);
              }}
              options={[{ value: "", label: "Todos los usuarios" }, ...users]}
            />
          </div>
          <div className="w-52">
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
      </div>

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <Skeleton className="h-10 w-full max-w-sm" />
          <SkeletonTable columns={tab === "batches" ? 6 : 8} rows={8} />
        </div>
      ) : tab === "batches" ? (
        /* ── Pestaña Pedidos (batches) ── */
        filteredBatches.length === 0 ? (
          <EmptyState title="Sin pedidos" description={batchStatusFilter ? "No hay tickets con ese estado." : "No hay pedidos que coincidan con los filtros."} />
        ) : (
          <>
            <Card className="overflow-hidden p-0">
              <div className={isRefreshing ? "opacity-50 transition-opacity" : ""}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Usuario</TableHead>
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
                          onClick={() => router.push(`/admin/shop/orders/batch/${batch.id}`)}
                        >
                          <TableCell className="text-text-muted text-sm whitespace-nowrap">
                            {formatShortDate(batch.purchaseDate)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="font-medium">{batch.user.name}</span>
                            <br />
                            <span className="text-text-muted text-xs">{batch.user.email}</span>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-text truncate max-w-[200px]">{summary}</p>
                            <p className="text-xs text-text-muted">{batch.items.length} artículo{batch.items.length !== 1 ? "s" : ""}</p>
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
              </div>
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
        filteredOrders.length === 0 ? (
          <EmptyState title="Sin artículos" description={orderStatusFilter ? "No hay artículos con ese estado." : "No hay artículos que coincidan con los filtros."} />
        ) : (
          <>
            <Card className="overflow-hidden p-0">
              <div className={isRefreshing ? "opacity-50 transition-opacity" : ""}>
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
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const status = ORDER_STATUS_MAP[order.status] ?? ORDER_STATUS_MAP.PAID;
                      return (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer hover:bg-primary/5"
                          onClick={() => router.push(`/admin/shop/orders/${order.id}?from=items`)}
                        >
                          <TableCell className="text-text-muted text-sm whitespace-nowrap">
                            {formatShortDate(order.purchaseDate)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="font-medium">{order.user.name}</span>
                            <br />
                            <span className="text-text-muted text-xs">{order.user.email}</span>
                          </TableCell>
                          <TableCell className="font-medium max-w-[150px] truncate">
                            {order.product.name}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-primary">{order.pricePaid} ShopTokens</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-text-muted">
                            {order.txHash.slice(0, 6)}…{order.txHash.slice(-4)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              {order.status === "PAID" && (
                                <Button size="sm" onClick={() => handleDeliverItem(order.id)}>
                                  Entregar
                                </Button>
                              )}
                              {(order.status === "PAID" || order.status === "DELIVERED") && (
                                <Button variant="danger" size="sm" onClick={() => handleReturnItem(order.id, order.product.name)}>
                                  Devolver
                                </Button>
                              )}
                              {order.status === "RETURNED" && (
                                <span className="text-xs text-text-muted">Devuelto</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <LinkArrow variant="static" size="sm" className="relative right-auto top-auto" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
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

      {/* Modal de confirmación de devolución */}
      <ConfirmModal
        open={!!returnModal}
        onClose={() => setReturnModal(null)}
        onConfirm={confirmReturn}
        loading={returning}
        title="Confirmar devolución"
        description={returnModal ? `¿Procesar devolución de "${returnModal.productName}"? Se reembolsarán los ShopTokens al usuario.` : ""}
        confirmLabel="Procesar devolución"
        variant="danger"
      />
    </div>
  );
}
