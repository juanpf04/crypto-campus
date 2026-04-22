"use client";

/**
 * Historial de pedidos del estudiante.
 *
 * Dos pestañas: "Tickets" (batches) + "Artículos" (orders individuales).
 * Filtro local por estado; se resetea al cambiar de tab.
 */

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { BackLink } from "@/components/ui/BackLink";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Tabs } from "@/components/ui/Tabs";
import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";
import {
  OrderBatchTable,
  type BatchTableRow,
} from "@/components/dashboard/OrderBatchTable";
import {
  OrderItemTable,
  type OrderTableRow,
} from "@/components/dashboard/OrderItemTable";

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
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const initialTab = searchParams.get("tab") === "items" ? "items" : "batches";
  const [tab, setTab] = useState(initialTab);
  const [batchStatusFilter, setBatchStatusFilter] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("");

  const batchesList = usePaginatedList<BatchTableRow>({
    endpoint: "/api/shop/batches",
    pageSize: PAGE_SIZE,
    onError: () => addToast("Error al cargar pedidos", "danger"),
    parseResponse: (data) => {
      const body = data as { batches?: BatchTableRow[]; total?: number };
      return { items: body.batches ?? [], total: body.total ?? 0 };
    },
  });

  const ordersList = usePaginatedList<OrderTableRow>({
    endpoint: "/api/shop/orders",
    pageSize: PAGE_SIZE,
    onError: () => addToast("Error al cargar artículos", "danger"),
    parseResponse: (data) => {
      const body = data as { orders?: OrderTableRow[]; total?: number };
      return { items: body.orders ?? [], total: body.total ?? 0 };
    },
  });

  const filteredBatches = useMemo(() => {
    if (!batchStatusFilter) return batchesList.items;
    return batchesList.items.filter((b) => b.generalStatus === batchStatusFilter);
  }, [batchesList.items, batchStatusFilter]);

  const filteredOrders = useMemo(() => {
    if (!orderStatusFilter) return ordersList.items;
    return ordersList.items.filter((o) => o.status === orderStatusFilter);
  }, [ordersList.items, orderStatusFilter]);

  const isLoading = tab === "batches" ? batchesList.loading : ordersList.loading;

  return (
    <div className="space-y-6">
      <BackLink href="/student/shop" label="Volver a la tienda" />

      <div>
        <h1 className="text-2xl font-bold text-text">Mis pedidos</h1>
        <p className="text-text-muted mt-1">
          Historial de todas tus compras en la tienda.
        </p>
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
        filteredBatches.length === 0 ? (
          <EmptyState
            title="Sin pedidos"
            description={batchStatusFilter ? "No hay tickets con ese estado." : "Aún no has realizado ninguna compra."}
          />
        ) : (
          <>
            <OrderBatchTable
              batches={filteredBatches}
              basePath="/student/shop/orders/batch"
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
        filteredOrders.length === 0 ? (
          <EmptyState
            title="Sin artículos"
            description={orderStatusFilter ? "No hay artículos con ese estado." : "Aún no has realizado ninguna compra."}
          />
        ) : (
          <>
            <OrderItemTable
              orders={filteredOrders}
              basePath="/student/shop/orders"
              navigationQuery="?from=items"
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
    </div>
  );
}
