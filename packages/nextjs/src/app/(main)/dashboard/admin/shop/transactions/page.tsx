"use client";

/**
 * Historial de transacciones del admin — Log unificado.
 *
 * Muestra todas las transacciones de ShopTokens (compras y recargas)
 * con paginación de 10 registros y filtro por usuario.
 */

import { useCallback, useEffect, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { icons } from "@/components/ui/icons";

const PAGE_SIZE = 10;

interface Transaction {
  id: string;
  type: "purchase" | "topup";
  date: string;
  userName: string;
  userEmail: string;
  amount: number;
  description: string;
  txHash: string | null;
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtro por usuario
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Cargar lista de usuarios para el filtro
  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []))
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
  }, [offset, selectedUserId]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Reset página al cambiar filtro
  function handleUserFilter(userId: string) {
    setSelectedUserId(userId);
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

      <SectionTitle icon={icons.pending}>Transacciones</SectionTitle>

      {/* Filtro por usuario */}
      <div className="flex items-center gap-3">
        <label htmlFor="user-filter" className="text-sm text-text-muted whitespace-nowrap">
          Filtrar por usuario:
        </label>
        <select
          id="user-filter"
          value={selectedUserId}
          onChange={(e) => handleUserFilter(e.target.value)}
          className="rounded-lg border border-border-default bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Todos los usuarios</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>

        <span className="text-xs text-text-muted ml-auto">
          {total} {total === 1 ? "transacción" : "transacciones"}
        </span>
      </div>

      {/* Tabla */}
      <Card className={`overflow-hidden p-0 transition-opacity ${refreshing ? "opacity-60" : ""}`}>
        {transactions.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Sin transacciones"
              description={selectedUserId ? "Este usuario no tiene transacciones." : "No hay transacciones registradas."}
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
                  <th className="px-4 py-3 text-right font-medium text-text-muted">Monto</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
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
                      <Badge variant={tx.type === "topup" ? "success" : "info"}>
                        {tx.type === "topup" ? "Recarga" : "Compra"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text">
                      {tx.description}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${tx.amount >= 0 ? "text-success" : "text-danger"}`}>
                      {tx.amount >= 0 ? "+" : ""}{tx.amount} ShopTokens
                    </td>
                  </tr>
                ))}
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
