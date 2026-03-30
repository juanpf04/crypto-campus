"use client";

/**
 * Detalle de un pedido agrupado (batch) para el estudiante.
 *
 * Filas limpias tipo recibo con checkboxes para seleccionar devoluciones en lote.
 * Barra flotante abajo cuando hay selección. Modal de confirmación.
 * Filtro por estado. Sin datos blockchain.
 * Click en fila → detalle del artículo pedido.
 *
 * Compone: BackLink, Card, Spinner, Tabs (atómicos) +
 *          BatchHeader, GroupedOrderItem, ReturnSelectionBar, ConfirmModal (intermedios)
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs } from "@/components/ui/Tabs";
import { SelectAllCheckbox } from "@/components/ui/SelectAllCheckbox";
import { BatchHeader } from "@/components/shared/BatchHeader";
import { GroupedOrderItem, groupOrderItems, type GroupedItem } from "@/components/shared/GroupedOrderItem";
import { ReturnSelectionBar } from "@/components/shared/ReturnSelectionBar";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { formatShortDate, calculateOrderStats } from "@/lib/formatters";

interface BatchOrderItem {
  id: string;
  orderId: number;
  productId: string;
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
  purchaseDate: string;
  generalStatus: string;
  items: BatchOrderItem[];
}

// Estado de selección por grupo
interface SelectionState {
  selected: boolean;
  count: number;
}

export default function StudentBatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [returning, setReturning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Selección: map de groupKey → { selected, count }
  const [selection, setSelection] = useState<Map<string, SelectionState>>(new Map());

  const loadBatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/shop/batches/${id}`);
      if (!res.ok) throw new Error("Error al cargar pedido");
      setBatch(await res.json());
      setSelection(new Map()); // Reset selección al recargar
    } catch {
      addToast("Error al cargar el pedido", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => { loadBatch(); }, [loadBatch]);

  const groupedItems = useMemo(() => {
    if (!batch) return [];
    return groupOrderItems(batch.items);
  }, [batch]);

  // Ordenar: entregados/pendientes arriba, devueltos abajo
  const sortedItems = useMemo(() => {
    const statusOrder: Record<string, number> = { PAID: 0, DELIVERED: 1, RETURNED: 2 };
    return [...groupedItems].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
  }, [groupedItems]);

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return sortedItems;
    return sortedItems.filter((g) => g.status === statusFilter);
  }, [sortedItems, statusFilter]);

  // Helpers de selección
  function getGroupKey(item: GroupedItem) {
    return `${item.name}|${item.color}|${item.status}`;
  }

  function toggleSelect(item: GroupedItem, selected: boolean) {
    const key = getGroupKey(item);
    setSelection((prev) => {
      const next = new Map(prev);
      if (selected) {
        next.set(key, { selected: true, count: item.returnableCount });
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  function updateCount(item: GroupedItem, count: number) {
    const key = getGroupKey(item);
    setSelection((prev) => {
      const next = new Map(prev);
      next.set(key, { selected: true, count });
      return next;
    });
  }

  // Calcular resumen de selección
  const selectedSummary = useMemo(() => {
    let totalCount = 0;
    let totalRefund = 0;
    const orderIdsToReturn: string[] = [];

    for (const item of groupedItems) {
      const key = getGroupKey(item);
      const sel = selection.get(key);
      if (!sel?.selected) continue;

      const count = Math.min(sel.count, item.returnableCount);
      totalCount += count;
      totalRefund += count * item.pricePaid;
      orderIdsToReturn.push(...item.orderIds.slice(0, count));
    }

    return { totalCount, totalRefund, orderIdsToReturn };
  }, [groupedItems, selection]);

  // Procesar devolución
  async function handleConfirmReturn() {
    setReturning(true);
    setConfirmOpen(false);

    try {
      for (const orderId of selectedSummary.orderIdsToReturn) {
        const res = await fetch(`/api/shop/orders/${orderId}/return`, { method: "PUT" });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "Error al devolver");
        }
      }
      addToast(
        selectedSummary.totalCount === 1
          ? "Artículo devuelto correctamente"
          : `${selectedSummary.totalCount} artículos devueltos correctamente`,
        "success",
      );
      await loadBatch();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setReturning(false);
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

  const { deliveredCount, returnedCount } = calculateOrderStats(batch.items);
  const hasMultipleStatuses = deliveredCount > 0 && returnedCount > 0;

  return (
    <div className="space-y-6 pb-20">
      <BackLink href="/dashboard/student/shop/orders" label="Volver a pedidos" />

      <BatchHeader
        batchId={batch.batchId}
        generalStatus={batch.generalStatus}
        purchaseDate={batch.purchaseDate}
        itemCount={batch.items.length}
        totalPaid={batch.totalPaid}
      />

      {/* Resumen si hay devueltos */}
      {returnedCount > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="text-center py-4">
            <p className="text-2xl font-bold text-success">{deliveredCount}</p>
            <p className="text-xs text-text-muted mt-1">Entregados</p>
          </Card>
          <Card className="text-center py-4">
            <p className="text-2xl font-bold text-danger">{returnedCount}</p>
            <p className="text-xs text-text-muted mt-1">Devueltos</p>
          </Card>
        </div>
      )}

      {/* Filtro */}
      {hasMultipleStatuses && (
        <Tabs
          tabs={[
            { value: "all", label: "Todos", count: groupedItems.length },
            { value: "DELIVERED", label: "Entregados", count: groupedItems.filter((g) => g.status === "DELIVERED").length },
            { value: "RETURNED", label: "Devueltos", count: groupedItems.filter((g) => g.status === "RETURNED").length },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      )}

      {/* Artículos — filas limpias tipo recibo */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between px-5 py-3 bg-primary/5 border-b border-border-default">
          <div className="flex items-center gap-3">
            {filteredItems.some((i) => i.returnableCount > 0) && (
              <SelectAllCheckbox
                allSelected={filteredItems.filter((i) => i.returnableCount > 0).every((i) => selection.has(getGroupKey(i)))}
                onToggle={(selectAll) => {
                  if (selectAll) {
                    const next = new Map(selection);
                    for (const item of filteredItems) {
                      if (item.returnableCount > 0) {
                        next.set(getGroupKey(item), { selected: true, count: item.returnableCount });
                      }
                    }
                    setSelection(next);
                  } else {
                    setSelection(new Map());
                  }
                }}
                label="Artículos"
              />
            )}
            {!filteredItems.some((i) => i.returnableCount > 0) && (
              <span className="text-sm font-semibold text-text">Artículos</span>
            )}
          </div>
          <span className="text-sm text-text-muted">{batch.items.length} producto{batch.items.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="divide-y divide-border-default">
          {filteredItems.map((item, idx) => {
            const key = getGroupKey(item);
            const sel = selection.get(key);

            return (
              <GroupedOrderItem
                key={`${key}-${idx}`}
                item={item}
                showCheckbox={item.returnableCount > 0}
                selected={sel?.selected ?? false}
                selectedCount={sel?.count ?? item.returnableCount}
                onSelectChange={(checked) => toggleSelect(item, checked)}
                onCountChange={(count) => updateCount(item, count)}
                onNavigate={() => {
                  router.push(`/dashboard/student/shop/orders/${item.orderIds[0]}?from=batch&batchId=${batch.id}`);
                }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between px-5 py-4 bg-primary/5 border-t border-border-default">
          <span className="text-sm font-semibold text-text">Total</span>
          <span className="text-lg font-bold text-primary">{batch.totalPaid} ShopTokens</span>
        </div>
      </Card>

      {/* Info del recibo */}
      <Card className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">Fecha de compra</span>
          <span className="text-text">{formatShortDate(batch.purchaseDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Nº de recibo</span>
          <span className="text-text">#{batch.batchId}</span>
        </div>
        {returnedCount > 0 && (
          <div className="flex justify-between">
            <span className="text-text-muted">Reembolsado</span>
            <span className="text-danger font-semibold">
              {batch.items.filter((i) => i.status === "RETURNED").reduce((sum, i) => sum + i.pricePaid, 0)} ShopTokens
            </span>
          </div>
        )}
        <p className="text-xs text-text-muted pt-2 border-t border-border-default mt-2">
          Tienes 30 días desde la entrega para devolver un artículo.
        </p>
      </Card>

      {/* Barra flotante de devolución */}
      <ReturnSelectionBar
        selectedCount={selectedSummary.totalCount}
        totalRefund={selectedSummary.totalRefund}
        onReturn={() => setConfirmOpen(true)}
        loading={returning}
      />

      {/* Modal de confirmación */}
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmReturn}
        loading={returning}
        title="Confirmar devolución"
        description={`¿Seguro que quieres devolver ${selectedSummary.totalCount} artículo${selectedSummary.totalCount !== 1 ? "s" : ""}? Se te reembolsarán ${selectedSummary.totalRefund} ShopTokens.`}
        confirmLabel="Confirmar devolución"
        variant="danger"
      />
    </div>
  );
}
