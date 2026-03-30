"use client";

/**
 * Historial de transacciones del admin — Log unificado.
 *
 * Muestra todas las transacciones de ShopTokens (compras, recargas, devoluciones)
 * con paginación y filtros por: usuario, tipo (compra/recarga/devolución),
 * dirección (ingreso/gasto).
 */

import { useCallback, useEffect, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { icons } from "@/components/ui/icons";

const PAGE_SIZE = 10;

interface Transaction {
  id: string;
  type: "purchase" | "topup" | "refund";
  direction: "income" | "expense";
  date: string;
  userName: string;
  userEmail: string;
  amount: number;
  description: string;
  txHash: string | null;
}

interface UserOption {
  value: string;
  label: string;
}

const TYPE_OPTIONS = [
  { value: "", label: "Todos los tipos" },
  { value: "purchase", label: "Compras" },
  { value: "topup", label: "Recargas" },
  { value: "refund", label: "Devoluciones" },
];

const DIRECTION_OPTIONS = [
  { value: "", label: "Ingresos y gastos" },
  { value: "income", label: "Ingresos" },
  { value: "expense", label: "Gastos" },
];

const TYPE_BADGE_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  purchase: { label: "Compra", variant: "info" },
  topup: { label: "Recarga", variant: "success" },
  refund: { label: "Devolución", variant: "warning" },
};

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");

  // Cargar lista de usuarios
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

  // Cargar transacciones
  const loadTransactions = useCallback(async () => {
    setRefreshing(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (selectedUserId) params.set("userId", selectedUserId);
    if (typeFilter) params.set("type", typeFilter);
    if (directionFilter) params.set("direction", directionFilter);

    try {
      const res = await fetch(`/api/shop/transactions?${params}`);
      const data = await res.json();
      setTransactions(data.transactions ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [offset, selectedUserId, typeFilter, directionFilter]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  function resetAndSetFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setOffset(0);
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
      <BackLink href="/dashboard/admin/shop" label="Volver a la tienda" />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <SectionTitle icon={icons.pending}>Transacciones</SectionTitle>
        <span className="text-sm text-text-muted">
          {total} {total === 1 ? "transacción" : "transacciones"}
        </span>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-56">
          <Select
            value={selectedUserId}
            onChange={(e) => resetAndSetFilter(setSelectedUserId, e.currentTarget.value)}
            options={[{ value: "", label: "Todos los usuarios" }, ...users]}
          />
        </div>
        <div className="w-44">
          <Select
            value={typeFilter}
            onChange={(e) => resetAndSetFilter(setTypeFilter, e.currentTarget.value)}
            options={TYPE_OPTIONS}
          />
        </div>
        <div className="w-44">
          <Select
            value={directionFilter}
            onChange={(e) => resetAndSetFilter(setDirectionFilter, e.currentTarget.value)}
            options={DIRECTION_OPTIONS}
          />
        </div>
      </div>

      {/* Tabla */}
      <Card className={`overflow-hidden p-0 transition-opacity ${refreshing ? "opacity-60" : ""}`}>
        {transactions.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Sin transacciones"
              description={
                selectedUserId || typeFilter || directionFilter
                  ? "No hay transacciones con esos filtros."
                  : "No hay transacciones registradas."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-primary/5">
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Usuario</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Descripción</th>
                  <th className="px-4 py-3 text-right font-medium text-text-muted">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const typeBadge = TYPE_BADGE_MAP[tx.type] ?? TYPE_BADGE_MAP.purchase;
                  return (
                    <tr key={tx.id} className="border-b border-border-default last:border-b-0 hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-text-muted">
                        {new Date(tx.date).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-text">{tx.userName}</p>
                        <p className="text-xs text-text-muted">{tx.userEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={typeBadge.variant}>{typeBadge.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-text">
                        {tx.description}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${tx.amount >= 0 ? "text-success" : "text-danger"}`}>
                        {tx.amount >= 0 ? "+" : ""}{tx.amount} ShopTokens
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Paginación */}
      {total > PAGE_SIZE && (
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          total={total}
          onChange={setOffset}
        />
      )}
    </div>
  );
}
