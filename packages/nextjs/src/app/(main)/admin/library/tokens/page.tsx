"use client";

/**
 * Gestión de LibraryTokens (admin).
 * Tabla de estudiantes con sus tokens y modal para modificar.
 * Mismo patrón que admin/printing/credits.
 */

import { useEffect, useState } from "react";
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
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

interface Student {
  id: string;
  name: string;
  email: string;
  balance: number | null;
}

export default function AdminLibraryTokensPage() {
  const { addToast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [newAmount, setNewAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/library/tokens");
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setStudents(list);
        setFiltered(list);
      } catch {
        addToast("Error al cargar datos", "danger");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [addToast]);

  function handleSearch(term: string) {
    if (!term) {
      setFiltered(students);
      return;
    }
    const lower = term.toLowerCase();
    setFiltered(
      students.filter(
        (s) => s.name.toLowerCase().includes(lower) || s.email.toLowerCase().includes(lower),
      ),
    );
  }

  function openEdit(student: Student) {
    setEditStudent(student);
    setNewAmount(String(student.balance ?? 0));
  }

  async function handleSave() {
    if (!editStudent) return;

    const amount = Number(newAmount);
    if (!Number.isInteger(amount) || amount < 0) {
      addToast("Introduce un número entero no negativo", "warning");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/library/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editStudent.id, amount }),
      });

      const body = await res.json();

      if (!res.ok) {
        addToast(body.error ?? "Error al asignar tokens", "danger");
        return;
      }

      const updatedBalance = body.balance ?? amount;
      setStudents((prev) =>
        prev.map((s) => (s.id === editStudent.id ? { ...s, balance: updatedBalance } : s)),
      );
      setFiltered((prev) =>
        prev.map((s) => (s.id === editStudent.id ? { ...s, balance: updatedBalance } : s)),
      );

      addToast(`Tokens de ${editStudent.name} actualizados a ${updatedBalance}`, "success");
      setEditStudent(null);
    } catch {
      addToast("Error de conexión", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonTable columns={4} rows={6} />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/library" label="Volver a biblioteca" />

      <div>
        <h1 className="text-2xl font-bold text-text">Tokens de Préstamo</h1>
        <p className="text-text-muted mt-1">
          Consulta y gestiona los tokens de préstamo de los estudiantes.
          Cada préstamo de biblioteca requiere 1 token como depósito.
        </p>
      </div>

      <SearchInput
        placeholder="Buscar estudiante por nombre o email..."
        onSearch={handleSearch}
        className="max-w-md"
      />

      {filtered.length === 0 ? (
        <EmptyState title="Sin estudiantes" description="No se encontraron estudiantes registrados." />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell className="text-text-muted">{student.email}</TableCell>
                  <TableCell>
                    <Badge variant={student.balance === 0 ? "danger" : "info"}>
                      {student.balance ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => openEdit(student)}>
                      Modificar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Modal
        open={editStudent !== null}
        onClose={() => setEditStudent(null)}
        title={`Tokens de ${editStudent?.name ?? ""}`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            Introduce la nueva cantidad de Tokens de Préstamo para este estudiante.
            Solo se pueden añadir tokens (mintear), no reducir el balance.
          </p>
          <Input
            label="Nuevos tokens"
            type="number"
            min="0"
            value={newAmount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAmount(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditStudent(null)}>Cancelar</Button>
            <Button loading={saving} onClick={handleSave}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
