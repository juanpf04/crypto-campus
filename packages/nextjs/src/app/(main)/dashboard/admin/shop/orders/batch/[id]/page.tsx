"use client";

/**
 * Detalle de un pedido agrupado (batch) para el admin.
 *
 * Mismo diseño que el estudiante pero con:
 * - Info del usuario
 * - Datos blockchain (txHash, IDs on-chain)
 * - Acciones: entregar + devolver (sin límite de tiempo)
 * - Barra flotante con ambas acciones
 *
 * Compone: BackLink, Card, Button, Spinner, Tabs (atómicos) +
 *          BatchHeader, GroupedOrderItem, ReturnSelectionBar,
 *          ConfirmModal, DetailField, SectionTitle (intermedios)
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
import { DetailField } from "@/components/shared/DetailField";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { icons } from "@/components/ui/icons";
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
  txHash: string;
  purchaseDate: string;
  generalStatus: string;
  user: { name: string; email: string };
  items: BatchOrderItem[];
}

interface SelectionState {
  selected: boolean;
  count: number;
}

export default function AdminBatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [acting, setActing] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selection, setSelection] = useState<Map<string, SelectionState>>(new Map());

  const loadBatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/shop/batches/${id}`);
      if (!res.ok) throw new Error("Error al cargar pedido");
      setBatch(await res.json());
      setSelection(new Map());
    } catch {
      addToast("Error al cargar el pedido", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => { loadBatch(); }, [loadBatch]);

  const groupedItems = useMemo(() => batch ? groupOrderItems(batch.items) : [], [batch]);
  const sortedItems = useMemo(() => {
    const statusOrder: Record<string, number> = { PAID: 0, DELIVERED: 1, RETURNED: 2 };
    return [...groupedItems].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
  }, [groupedItems]);

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return sortedItems;
    return sortedItems.filter((g) => g.status === statusFilter);
  }, [sortedItems, statusFilter]);

  function getGroupKey(item: GroupedItem) {
    return `${item.name}|${item.color}|${item.status}`;
  }

  function toggleSelect(item: GroupedItem, selected: boolean) {
    const key = getGroupKey(item);
    setSelection((prev) => {
      const next = new Map(prev);
      if (selected) {
        // Admin: devolver todos devolvibles por defecto
        const actionableCount = item.returnableCount || item.deliverableCount || item.quantity;
        next.set(key, { selected: true, count: actionableCount });
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
        // Devolver
        const returnableN = Math.min(count, item.returnableCount || item.quantity);
        returnCount += returnableN;
        returnRefund += returnableN * item.pricePaid;
        orderIdsToReturn.push(...item.orderIds.slice(0, returnableN));
      }

      if (item.status === "PAID") {
        const deliverableN = Math.min(count, item.deliverableCount);
        deliverCount += deliverableN;
        orderIdsToDeliver.push(...item.orderIds.slice(0, deliverableN));
      }
    }

    return { returnCount, returnRefund, deliverCount, orderIdsToReturn, orderIdsToDeliver };
  }, [groupedItems, selection]);

  // Devolver selección
  async function handleConfirmReturn() {
    setActing("return");
    setConfirmOpen(false);
    try {
      for (const orderId of selectedSummary.orderIdsToReturn) {
        const res = await fetch(`/api/shop/orders/${orderId}/return`, { method: "PUT" });
        if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      }
      addToast(`${selectedSummary.returnCount} devolución(es) procesada(s)`, "success");
      await loadBatch();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setActing(null);
    }
  }

  // Entregar selección
  async function handleDeliverSelected() {
    setActing("deliver-sel");
    try {
      for (const orderId of selectedSummary.orderIdsToDeliver) {
        const res = await fetch(`/api/shop/orders/${orderId}/deliver`, { method: "PUT" });
        if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      }
      addToast(`${selectedSummary.deliverCount} artículo(s) entregado(s)`, "success");
      await loadBatch();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!batch) {
    return (
      <div className="space-y-6">
        <BackLink href="/dashboard/admin/shop/orders" label="Volver a pedidos" />
        <p className="text-text-muted">Pedido no encontrado.</p>
      </div>
    );
  }

  const { deliveredCount, returnedCount } = calculateOrderStats(batch.items);

  return (
    <div className="space-y-6 pb-20">
      <BackLink href="/dashboard/admin/shop/orders" label="Volver a pedidos" />

      <BatchHeader
        batchId={batch.batchId}
        generalStatus={batch.generalStatus}
        purchaseDate={batch.purchaseDate}
        itemCount={batch.items.length}
        totalPaid={batch.totalPaid}
        user={batch.user}
      />

      {/* Stats — solo si hay mezcla de entregados y devueltos */}
      {deliveredCount > 0 && returnedCount > 0 && (
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

      {/* Filtro — solo si hay mezcla de entregados y devueltos */}
      {deliveredCount > 0 && returnedCount > 0 && (
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

      {/* Artículos */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Artículos del pedido</SectionTitle>

        <Card className="overflow-hidden p-0">
          {/* Header con seleccionar todos */}
          {filteredItems.some((i) => i.returnableCount > 0) && (
            <div className="px-5 py-3 bg-primary/5 border-b border-border-default">
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
              />
            </div>
          )}

          <div className="divide-y divide-border-default">
          {filteredItems.map((item, idx) => {
            const key = getGroupKey(item);
            const sel = selection.get(key);
            const canSelect = item.returnableCount > 0 || item.deliverableCount > 0;

            return (
              <GroupedOrderItem
                key={`${key}-${idx}`}
                item={item}
                showCheckbox={canSelect}
                selected={sel?.selected ?? false}
                selectedCount={sel?.count ?? (item.returnableCount || item.deliverableCount || item.quantity)}
                onSelectChange={(checked) => toggleSelect(item, checked)}
                onCountChange={(count) => updateCount(item, count)}
                onNavigate={() => router.push(`/dashboard/admin/shop/orders/${item.orderIds[0]}?from=batch&batchId=${batch.id}`)}
              />
            );
          })}
          </div>
        </Card>
      </section>

      {/* Detalles técnicos (solo admin) */}
      <Card className="space-y-3">
        <DetailField label="Hash de transacción" value={
          <span className="font-mono text-xs break-all">{batch.txHash}</span>
        } />
        <DetailField label="Fecha de compra" value={formatShortDate(batch.purchaseDate)} />
        <DetailField label="ID on-chain" value={`Batch #${batch.batchId}`} />
      </Card>

      {/* Barra flotante */}
      <ReturnSelectionBar
        selectedCount={selectedSummary.returnCount}
        totalRefund={selectedSummary.returnRefund}
        onReturn={() => setConfirmOpen(true)}
        loading={acting === "return"}
        onDeliver={selectedSummary.deliverCount > 0 ? handleDeliverSelected : undefined}
        deliverLoading={acting === "deliver-sel"}
        deliverableSelected={selectedSummary.deliverCount}
      />

      {/* Modal */}
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmReturn}
        loading={acting === "return"}
        title="Confirmar devolución"
        description={`¿Procesar devolución de ${selectedSummary.returnCount} artículo${selectedSummary.returnCount !== 1 ? "s" : ""}? Reembolso: ${selectedSummary.returnRefund} ShopTokens.`}
        confirmLabel="Procesar devolución"
        variant="danger"
      />
    </div>
  );
}
