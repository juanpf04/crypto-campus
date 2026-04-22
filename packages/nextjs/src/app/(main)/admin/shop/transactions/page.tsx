"use client";

/**
 * Historial de transacciones del admin — Log unificado.
 *
 * Muestra todas las transacciones de ShopTokens (compras, recargas, devoluciones)
 * con paginación y filtros por: usuario, tipo (compra/recarga/devolución),
 * dirección (ingreso/gasto).
 */

import { useEffect, useState } from "react";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { icons } from "@/components/ui/icons";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

const PAGE_SIZE = 10;

interface Transaction {
  id: string;
  type: "purchase" | "topup" | "refund" | "reward";
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
  { value: "reward", label: "Recompensas" },
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
  reward: { label: "Recompensa", variant: "success" },
};

export default function AdminTransactionsPage() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");

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

  const list = usePaginatedList<Transaction>({
    endpoint: "/api/shop/transactions",
    pageSize: PAGE_SIZE,
    filters: {
      userId: selectedUserId || null,
      type: typeFilter || null,
      direction: directionFilter || null,
    },
    parseResponse: (data) => {
      const body = data as { transactions?: Transaction[]; total?: number };
      return {
        items: body.transactions ?? [],
        total: body.total ?? 0,
      };
    },
  });

  if (list.loading && list.items.length === 0) return <SkeletonTable columns={5} rows={8} />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/shop" label="Volver a la tienda" />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <SectionTitle icon={icons.pending}>Transacciones</SectionTitle>
        <span className="text-sm text-text-muted">
          {list.total} {list.total === 1 ? "transacción" : "transacciones"}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-56">
          <Select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.currentTarget.value)}
            options={[{ value: "", label: "Todos los usuarios" }, ...users]}
          />
        </div>
        <div className="w-44">
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.currentTarget.value)}
            options={TYPE_OPTIONS}
          />
        </div>
        <div className="w-44">
          <Select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.currentTarget.value)}
            options={DIRECTION_OPTIONS}
          />
        </div>
      </div>

      <Card className={`overflow-hidden p-0 transition-opacity ${list.loading ? "opacity-60" : ""}`}>
        {list.items.length === 0 ? (
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.items.map((tx) => {
                const typeBadge = TYPE_BADGE_MAP[tx.type] ?? TYPE_BADGE_MAP.purchase;
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap text-text-muted">
                      {new Date(tx.date).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-text">{tx.userName}</p>
                      <p className="text-xs text-text-muted">{tx.userEmail}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeBadge.variant}>{typeBadge.label}</Badge>
                    </TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell className={`text-right font-semibold whitespace-nowrap ${tx.amount >= 0 ? "text-success" : "text-danger"}`}>
                      {tx.amount >= 0 ? "+" : ""}{tx.amount} ShopTokens
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Pagination
        offset={list.offset}
        limit={list.limit}
        total={list.total}
        onChange={list.setOffset}
      />
    </div>
  );
}
