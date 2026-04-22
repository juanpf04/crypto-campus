"use client";

/**
 * OrderBatchDetailView — Vista del detalle de un batch de la tienda.
 *
 * Compone BatchHeader + stats + tabs de filtro + lista de items agrupados +
 * selección múltiple + barra flotante + modal de confirmación. Usado por
 * admin y student (diferencias via `mode`).
 *
 * Maneja internamente el estado de selección. Las acciones (return/deliver)
 * se delegan al padre.
 */

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { SelectAllCheckbox } from "@/components/ui/SelectAllCheckbox";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { BatchHeader } from "@/components/shared/BatchHeader";
import { GroupedOrderItem, groupOrderItems, type GroupedItem } from "@/components/shared/GroupedOrderItem";
import { ReturnSelectionBar } from "@/components/shared/ReturnSelectionBar";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { icons } from "@/components/ui/icons";
import { calculateOrderStats } from "@/lib/formatters";

export interface BatchDetailItem {
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

export interface BatchDetailPayload {
  id: string;
  batchId: number;
  totalPaid: number;
  purchaseDate: string;
  generalStatus: string;
  items: BatchDetailItem[];
  user?: { name: string; email: string };
}

interface SelectionState {
  selected: boolean;
  count: number;
}

interface OrderBatchDetailViewProps {
  batch: BatchDetailPayload;
  /** "admin" habilita devoluciones sin límite de tiempo + botón de entregar. */
  mode: "admin" | "student";
  onReturn: (orderIds: string[]) => Promise<void>;
  onDeliver?: (orderIds: string[]) => Promise<void>;
  onNavigateToOrder: (orderId: string) => void;
}

function getGroupKey(item: GroupedItem) {
  return `${item.name}|${item.color}|${item.status}`;
}

export function OrderBatchDetailView({
  batch,
  mode,
  onReturn,
  onDeliver,
  onNavigateToOrder,
}: OrderBatchDetailViewProps) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selection, setSelection] = useState<Map<string, SelectionState>>(new Map());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [acting, setActing] = useState<"return" | "deliver" | null>(null);

  const isAdmin = mode === "admin";

  const groupedItems = useMemo(() => groupOrderItems(batch.items), [batch.items]);
  const sortedItems = useMemo(() => {
    const statusOrder: Record<string, number> = { PAID: 0, DELIVERED: 1, RETURNED: 2 };
    return [...groupedItems].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
  }, [groupedItems]);

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return sortedItems;
    return sortedItems.filter((g) => g.status === statusFilter);
  }, [sortedItems, statusFilter]);

  function toggleSelect(item: GroupedItem, selected: boolean) {
    const key = getGroupKey(item);
    setSelection((prev) => {
      const next = new Map(prev);
      if (selected) {
        const defaultCount = isAdmin
          ? (item.returnableCount || item.deliverableCount || item.quantity)
          : item.returnableCount;
        next.set(key, { selected: true, count: defaultCount });
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

  const selectedSummary = useMemo(() => {
    let returnCount = 0;
    let returnRefund = 0;
    let deliverCount = 0;
    const orderIdsToReturn: string[] = [];
    const orderIdsToDeliver: string[] = [];

    for (const item of groupedItems) {
      const key = getGroupKey(item);
      const sel = selection.get(key);
      if (!sel?.selected) continue;

      const count = sel.count;

      if (item.status === "DELIVERED" || item.status === "PAID") {
        const returnableN = Math.min(count, item.returnableCount || item.quantity);
        returnCount += returnableN;
        returnRefund += returnableN * item.pricePaid;
        orderIdsToReturn.push(...item.orderIds.slice(0, returnableN));
      }

      if (isAdmin && item.status === "PAID") {
        const deliverableN = Math.min(count, item.deliverableCount);
        deliverCount += deliverableN;
        orderIdsToDeliver.push(...item.orderIds.slice(0, deliverableN));
      }
    }

    return { returnCount, returnRefund, deliverCount, orderIdsToReturn, orderIdsToDeliver };
  }, [groupedItems, selection, isAdmin]);

  async function handleConfirmReturn() {
    setActing("return");
    setConfirmOpen(false);
    try {
      await onReturn(selectedSummary.orderIdsToReturn);
      setSelection(new Map());
    } finally {
      setActing(null);
    }
  }

  async function handleDeliverSelected() {
    if (!onDeliver) return;
    setActing("deliver");
    try {
      await onDeliver(selectedSummary.orderIdsToDeliver);
      setSelection(new Map());
    } finally {
      setActing(null);
    }
  }

  const { deliveredCount, returnedCount } = calculateOrderStats(batch.items);
  const showStats = isAdmin
    ? deliveredCount > 0 && returnedCount > 0
    : returnedCount > 0;
  const hasMultipleStatuses = deliveredCount > 0 && returnedCount > 0;

  return (
    <>
      <BatchHeader
        batchId={batch.batchId}
        generalStatus={batch.generalStatus}
        purchaseDate={batch.purchaseDate}
        itemCount={batch.items.length}
        totalPaid={batch.totalPaid}
        user={batch.user}
      />

      {showStats && (
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

      <section className="space-y-4">
        {isAdmin && <SectionTitle icon={icons.items}>Artículos del pedido</SectionTitle>}

        <Card className="overflow-hidden p-0">
          {filteredItems.some((i) => i.returnableCount > 0) && (
            <div className="flex items-center justify-between px-5 py-3 bg-primary/5 border-b border-border-default">
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
                label={isAdmin ? undefined : "Artículos"}
              />
              {!isAdmin && (
                <span className="text-sm text-text-muted">
                  {batch.items.length} producto{batch.items.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          <div className="divide-y divide-border-default">
            {filteredItems.map((item, idx) => {
              const key = getGroupKey(item);
              const sel = selection.get(key);
              const canSelect = isAdmin
                ? item.returnableCount > 0 || item.deliverableCount > 0
                : item.returnableCount > 0;

              return (
                <GroupedOrderItem
                  key={`${key}-${idx}`}
                  item={item}
                  showCheckbox={canSelect}
                  selected={sel?.selected ?? false}
                  selectedCount={sel?.count ?? (isAdmin
                    ? (item.returnableCount || item.deliverableCount || item.quantity)
                    : item.returnableCount
                  )}
                  onSelectChange={(checked) => toggleSelect(item, checked)}
                  onCountChange={(count) => updateCount(item, count)}
                  onNavigate={() => onNavigateToOrder(item.orderIds[0])}
                />
              );
            })}
          </div>

          {!isAdmin && (
            <div className="flex items-center justify-between px-5 py-4 bg-primary/5 border-t border-border-default">
              <span className="text-sm font-semibold text-text">Total</span>
              <span className="text-lg font-bold text-primary">{batch.totalPaid} ShopTokens</span>
            </div>
          )}
        </Card>
      </section>

      <ReturnSelectionBar
        selectedCount={selectedSummary.returnCount}
        totalRefund={selectedSummary.returnRefund}
        onReturn={() => setConfirmOpen(true)}
        loading={acting === "return"}
        onDeliver={isAdmin && selectedSummary.deliverCount > 0 ? handleDeliverSelected : undefined}
        deliverLoading={acting === "deliver"}
        deliverableSelected={selectedSummary.deliverCount}
      />

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmReturn}
        loading={acting === "return"}
        title="Confirmar devolución"
        description={
          isAdmin
            ? `¿Procesar devolución de ${selectedSummary.returnCount} artículo${selectedSummary.returnCount !== 1 ? "s" : ""}? Reembolso: ${selectedSummary.returnRefund} ShopTokens.`
            : `¿Seguro que quieres devolver ${selectedSummary.returnCount} artículo${selectedSummary.returnCount !== 1 ? "s" : ""}? Se te reembolsarán ${selectedSummary.returnRefund} ShopTokens.`
        }
        confirmLabel={isAdmin ? "Procesar devolución" : "Confirmar devolución"}
        variant="danger"
      />
    </>
  );
}
