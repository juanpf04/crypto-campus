"use client";

/**
 * Gestión de ShopTokens (admin).
 *
 * Lista todos los estudiantes/profesores con su balance actual.
 * Permite modificar el balance absoluto con un modal (mismo patrón que
 * admin/printing/credits y admin/library/tokens).
 */

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

interface UserWithBalance {
  id: string;
  name: string;
  email: string;
  role: string;
  balance: number | null;
}

export default function AdminShopTokensPage() {
  const { addToast } = useToast();

  const [users, setUsers] = useState<UserWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal de modificar balance
  const [editingUser, setEditingUser] = useState<UserWithBalance | null>(null);
  const [newAmount, setNewAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // 1. Cargar usuarios (solo estudiantes y profesores)
        const usersRes = await fetch("/api/admin/users");
        const usersData = await usersRes.json();
        const eligibleUsers = (usersData.users ?? []).filter(
          (u: { role: string }) => u.role === "STUDENT" || u.role === "PROFESSOR",
        );

        // 2. Cargar balances en paralelo
        const withBalances = await Promise.all(
          eligibleUsers.map(async (u: { id: string; name: string; email: string; role: string }) => {
            try {
              const balRes = await fetch(`/api/shop/balance/${u.id}`);
              const balData = await balRes.json();
              return { ...u, balance: balData.balance ?? null };
            } catch {
              return { ...u, balance: null };
            }
          }),
        );

        setUsers(withBalances);
      } catch {
        addToast("Error al cargar datos", "danger");
      } finally {
        setLoading(false);
      }
    })();
  }, [addToast]);

  // Filtro por nombre/email
  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  function openEdit(user: UserWithBalance) {
    setEditingUser(user);
    setNewAmount(String(user.balance ?? 0));
  }

  async function handleSave() {
    if (!editingUser) return;
    const amount = parseInt(newAmount, 10);
    if (isNaN(amount) || amount < 0) {
      addToast("La cantidad debe ser un entero no negativo", "danger");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/shop/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editingUser.id, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al asignar tokens");

      const updatedBalance = data.balance ?? amount;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id ? { ...u, balance: updatedBalance } : u,
        ),
      );
      addToast(`Balance de ${editingUser.name} actualizado a ${updatedBalance} ShopTokens`, "success");
      setEditingUser(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonTable columns={5} rows={6} />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/shop" label="Volver a tienda" />

      <div>
        <h1 className="text-2xl font-bold text-text">ShopTokens</h1>
        <p className="text-text-muted mt-1">
          Consulta y asigna ShopTokens a estudiantes y profesores.
        </p>
      </div>

      <SearchInput
        placeholder="Buscar por nombre o email..."
        onSearch={setSearch}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="No se encontraron usuarios que coincidan."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-text-muted">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "STUDENT" ? "info" : "success"}>
                      {user.role === "STUDENT" ? "Estudiante" : "Profesor"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.balance === 0 ? "danger" : "info"}>
                      {user.balance ?? "—"} ShopTokens
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => openEdit(user)}>
                      Modificar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Modal de modificar balance */}
      <Modal
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`ShopTokens de ${editingUser?.name ?? ""}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Introduce la nueva cantidad de ShopTokens para este usuario.
            Puedes poner 0 para quitarle todos los tokens.
          </p>
          <Input
            label="Nuevos tokens"
            type="number"
            min="0"
            value={newAmount}
            onChange={(e) => setNewAmount(e.currentTarget.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="danger" onClick={() => setEditingUser(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
