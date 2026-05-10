"use client";

/**
 * Gestión de pedidos de la tienda (admin).
 *
 * Dos pestañas: "Pedidos" (batches) + "Artículos" (orders sueltos).
 * Filtro por usuario (server-side) y por estado (client-side).
 * Acciones: marcar entregado (individual), procesar devolución.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { BackLink } from "@/components/ui/BackLink";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Tabs } from "@/components/ui/Tabs";
import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import {
  OrderBatchTable,
  type BatchTableRow,
} from "@/components/dashboard/OrderBatchTable";
import {
  OrderItemTable,
  type OrderTableRow,
} from "@/components/dashboard/OrderItemTable";

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
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const initialTab = searchParams.get("tab") === "items" ? "items" : "batches";
  const [tab, setTab] = useState(initialTab);
  const [userFilter, setUserFilter] = useState("");
  const [batchStatusFilter, setBatchStatusFilter] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);

  const [returnModal, setReturnModal] = useState<{ orderId: string; productName: string } | null>(null);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        const rows = Array.isArray(data) ? data : data.users;
        if (Array.isArray(rows)) {
          setUsers(rows.map((u: { id: string; name: string; email: string }) => ({
            value: u.id,
            label: `${u.name} (${u.email})`,
          })));
        }
      })
      .catch(() => {});
  }, []);

  const batchesList = usePaginatedList<BatchTableRow>({
    endpoint: "/api/shop/batches/admin",
    pageSize: PAGE_SIZE,
    filters: {
      userId: userFilter || null,
      generalStatus: batchStatusFilter || null,
    },
    onError: () => addToast("Error al cargar pedidos", "danger"),
    parseResponse: (data) => {
      const body = data as { batches?: BatchTableRow[]; total?: number };
      return { items: body.batches ?? [], total: body.total ?? 0 };
    },
  });

  const ordersList = usePaginatedList<OrderTableRow>({
    endpoint: "/api/shop/orders/admin",
    pageSize: PAGE_SIZE,
    filters: {
      userId: userFilter || null,
      status: orderStatusFilter || null,
    },
    onError: () => addToast("Error al cargar artículos", "danger"),
    parseResponse: (data) => {
      const body = data as { orders?: OrderTableRow[]; total?: number };
      return { items: body.orders ?? [], total: body.total ?? 0 };
    },
  });

  async function handleDeliverItem(orderId: string) {
    try {
      const res = await fetch(`/api/shop/orders/${orderId}/deliver`, { method: "PUT" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error");
      }
      addToast("Artículo marcado como entregado", "success");
      ordersList.refresh();
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
      ordersList.refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setReturning(false);
    }
  }

  // Los filtros (userId, generalStatus, status) se envían al servidor — items
  // y total ya vienen filtrados, así que renderizamos los listados directos.
  const isLoading = tab === "batches" ? batchesList.loading : ordersList.loading;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/shop" label="Volver a tienda" />

      <div>
        <h1 className="text-2xl font-bold text-text">Pedidos</h1>
        <p className="text-text-muted mt-1">Gestión de todos los pedidos del sistema.</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs
          tabs={[
            { value: "batches", label: "Tickets", count: batchesList.total },
            { value: "items", label: "Artículos", count: ordersList.total },
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
              onChange={(e) => setUserFilter(e.currentTarget.value)}
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
        batchesList.items.length === 0 ? (
          <EmptyState title="Sin pedidos" description={batchStatusFilter ? "No hay tickets con ese estado." : "No hay pedidos que coincidan con los filtros."} />
        ) : (
          <>
            <OrderBatchTable
              batches={batchesList.items}
              basePath="/admin/shop/orders/batch"
              showUser
            />
            <Pagination
              offset={batchesList.offset}
              limit={batchesList.limit}
              total={batchesList.total}
              onChange={batchesList.setOffset}
            />
          </>
        )
      ) : (
        ordersList.items.length === 0 ? (
          <EmptyState title="Sin artículos" description={orderStatusFilter ? "No hay artículos con ese estado." : "No hay artículos que coincidan con los filtros."} />
        ) : (
          <>
            <OrderItemTable
              orders={ordersList.items}
              basePath="/admin/shop/orders"
              navigationQuery="?from=items"
              showUser
              showTxHash
              onDeliver={handleDeliverItem}
              onReturn={handleReturnItem}
            />
            <Pagination
              offset={ordersList.offset}
              limit={ordersList.limit}
              total={ordersList.total}
              onChange={ordersList.setOffset}
            />
          </>
        )
      )}

      <ConfirmModal
        open={!!returnModal}
        onClose={() => setReturnModal(null)}
        onConfirm={confirmReturn}
        loading={returning}
        title="Confirmar devolución"
        description={returnModal ? `¿Procesar devolución de "${returnModal.productName}"? Se reembolsarán los ShopTokens al usuario.` : ""}
        confirmLabel="Procesar devolución"
      />
    </div>
  );
}
