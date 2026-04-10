"use client";

/**
 * Lista de usuarios del sistema.
 * Solo accesible por ADMIN.
 * Muestra tabla con nombre, email, rol, estado y fecha de registro.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";

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
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.users ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Usuarios</h1>
          <p className="text-text-muted mt-1">
            {users.length} usuario{users.length !== 1 && "s"} registrado{users.length !== 1 && "s"}
          </p>
        </div>
        <Link href="/admin/users/new">
          <Button>Crear usuario</Button>
        </Link>
      </div>

      {/* Tabla */}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Registro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const badge = roleBadge[user.role] ?? { label: user.role, variant: "info" as const };
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
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
