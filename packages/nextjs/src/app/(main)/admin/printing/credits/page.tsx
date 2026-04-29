"use client";

/**
 * Gestión de créditos de impresión (admin).
 *
 * Lista alumnos y profesores junto con sus créditos actuales. El admin puede
 * modificar los créditos de cualquiera mediante un modal con input numérico.
 * Filtros: chips de rol (Todos/Alumnos/Profesores) + buscador por nombre/email.
 */

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { cn } from "@/lib/utils";

type MemberRole = "STUDENT" | "PROFESSOR";

interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  credits: number | null;
}

type RoleFilter = "ALL" | MemberRole;

const ROLE_FILTERS: Array<{ value: RoleFilter; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "STUDENT", label: "Alumnos" },
  { value: "PROFESSOR", label: "Profesores" },
];

export default function AdminPrintingCreditsPage() {
  const { addToast } = useToast();

  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [loading, setLoading] = useState(true);

  // Modal de edición de créditos
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [newCredits, setNewCredits] = useState("");
  const [saving, setSaving] = useState(false);

  // Cargar usuarios + créditos
  useEffect(() => {
    async function loadData() {
      try {
        const usersRes = await fetch("/api/admin/users");
        const usersData = await usersRes.json();
        const allUsers = (usersData.users ?? []) as Array<{
          id: string;
          name: string;
          email: string;
          role: string;
        }>;

        // Solo alumnos y profesores tienen créditos asignables
        const eligible = allUsers.filter(
          (u): u is typeof u & { role: MemberRole } =>
            u.role === "STUDENT" || u.role === "PROFESSOR",
        );

        // Cargar créditos de cada usuario en paralelo
        const withCredits = await Promise.all(
          eligible.map(async (u) => {
            try {
              const res = await fetch(`/api/printer/credits/${u.id}`);
              const data = await res.json();
              return { ...u, credits: data.availableCredits ?? null } as Member;
            } catch {
              return { ...u, credits: null } as Member;
            }
          }),
        );

        setMembers(withCredits);
      } catch {
        addToast("Error al cargar datos", "danger");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [addToast]);

  // Filtrado combinado por rol y término de búsqueda
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "ALL" && m.role !== roleFilter) return false;
      if (!term) return true;
      return (
        m.name.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term)
      );
    });
  }, [members, roleFilter, search]);

  /** Abrir modal para editar créditos */
  function openEdit(member: Member) {
    setEditMember(member);
    setNewCredits(String(member.credits ?? 0));
  }

  /** Guardar nuevos créditos */
  async function handleSaveCredits() {
    if (!editMember) return;

    const credits = Number(newCredits);
    if (!Number.isInteger(credits) || credits < 0) {
      addToast("Introduce un número entero no negativo", "warning");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/printer/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editMember.id, credits }),
      });

      const body = await res.json();

      if (!res.ok) {
        addToast(body.error ?? "Error al asignar créditos", "danger");
        return;
      }

      const updatedCredits = body.credits ?? credits;
      setMembers((prev) =>
        prev.map((m) =>
          m.id === editMember.id ? { ...m, credits: updatedCredits } : m,
        ),
      );

      addToast(
        `Créditos de ${editMember.name} actualizados a ${updatedCredits}`,
        "success",
      );
      setEditMember(null);
    } catch {
      addToast("Error de conexión", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonTable columns={5} rows={6} />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/printing" label="Volver a impresión" />

      <div>
        <h1 className="text-2xl font-bold text-text">Créditos de impresión</h1>
        <p className="text-text-muted mt-1">
          Consulta y gestiona los créditos de impresión de alumnos y profesores.
        </p>
      </div>

      {/* Controles: filtro de rol + buscador */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-border-default bg-card p-1">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setRoleFilter(f.value)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer",
                roleFilter === f.value
                  ? "bg-primary text-white"
                  : "text-text-muted hover:text-text",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <SearchInput
          placeholder="Buscar usuario por nombre o email..."
          onSearch={setSearch}
          className="max-w-md"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin usuarios"
          description="No se encontraron alumnos ni profesores con esos criterios."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Créditos</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-text-muted">{m.email}</TableCell>
                  <TableCell>
                    <Badge variant={m.role === "STUDENT" ? "info" : "success"}>
                      {m.role === "STUDENT" ? "Alumno" : "Profesor"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.credits === 0 ? "danger" : "info"}>
                      {m.credits ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="primary" size="sm" onClick={() => openEdit(m)}>
                      Modificar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Modal de edición de créditos */}
      <Modal
        open={editMember !== null}
        onClose={() => setEditMember(null)}
        title={`Créditos de ${editMember?.name ?? ""}`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            Introduce la nueva cantidad de créditos para este usuario.
            Puedes poner 0 para quitarle todos los créditos.
          </p>
          <Input
            label="Nuevos créditos"
            type="number"
            min="0"
            value={newCredits}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCredits(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="danger" onClick={() => setEditMember(null)}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={handleSaveCredits}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
