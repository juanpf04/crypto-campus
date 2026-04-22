"use client";

/**
 * Lista de usuarios del sistema.
 * Solo accesible por ADMIN.
 * Muestra tabla con nombre, email, rol, estado y acciones (editar/desactivar/reactivar).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/useToast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { ConfirmModal } from "@/components/shared/ConfirmModal";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

const roleBadge: Record<string, { label: string; variant: "info" | "success" | "warning" | "danger" }> = {
  STUDENT: { label: "Estudiante", variant: "info" },
  PROFESSOR: { label: "Profesor", variant: "success" },
  LIBRARIAN: { label: "Bibliotecario", variant: "warning" },
  ADMIN: { label: "Admin", variant: "danger" },
};

export default function UsersListPage() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Confirmación para desactivar/reactivar
  const [confirmTarget, setConfirmTarget] = useState<User | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      addToast("Error al cargar usuarios", "danger");
    }
  }, [addToast]);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()).catch(() => ({ user: null })),
      loadUsers(),
    ])
      .then(([me]) => setCurrentUserId(me?.user?.id ?? null))
      .finally(() => setLoading(false));
  }, [loadUsers]);

  async function handleToggleActive() {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${confirmTarget.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !confirmTarget.active }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");

      addToast(
        confirmTarget.active
          ? `${confirmTarget.name} desactivado`
          : `${confirmTarget.name} reactivado`,
        "success",
      );
      setConfirmTarget(null);
      await loadUsers();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al cambiar estado", "danger");
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Usuarios</h1>
          {loading ? (
            <Skeleton className="mt-2 h-4 w-56" />
          ) : (
            <p className="text-text-muted mt-1">
              {users.length} usuario{users.length !== 1 && "s"} registrado{users.length !== 1 && "s"}
            </p>
          )}
        </div>
        <Link href="/admin/users/new">
          <Button disabled={loading}>Crear usuario</Button>
        </Link>
      </div>

      {/* Tabla */}
      {loading ? (
        <SkeletonTable columns={6} rows={8} />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const badge = roleBadge[user.role] ?? { label: user.role, variant: "info" as const };
                const isSelf = user.id === currentUserId;
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-text-muted">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.active ? "success" : "neutral"}>
                        {user.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-text-muted text-sm">
                      {new Date(user.createdAt).toLocaleDateString("es-ES")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/users/${user.id}/edit`}>
                          <Button size="sm" variant="ghost">Editar</Button>
                        </Link>
                        {user.active ? (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={isSelf}
                            title={isSelf ? "No puedes desactivar tu propia cuenta" : undefined}
                            onClick={() => setConfirmTarget(user)}
                          >
                            Desactivar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setConfirmTarget(user)}
                          >
                            Reactivar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <ConfirmModal
        open={confirmTarget !== null}
        onClose={() => !confirmLoading && setConfirmTarget(null)}
        onConfirm={handleToggleActive}
        title={confirmTarget?.active ? "Desactivar usuario" : "Reactivar usuario"}
        description={
          confirmTarget?.active
            ? `¿Seguro que quieres desactivar a ${confirmTarget?.name}? No podrá iniciar sesión hasta que lo reactives.`
            : `¿Reactivar a ${confirmTarget?.name}? Recuperará acceso al login.`
        }
        confirmLabel={confirmTarget?.active ? "Desactivar" : "Reactivar"}
        variant={confirmTarget?.active ? "danger" : "primary"}
        loading={confirmLoading}
      />
    </div>
  );
}
