"use client";

/**
 * Gestión de créditos de impresión (admin).
 *
 * Muestra tabla con todos los estudiantes y sus créditos actuales.
 * El admin puede modificar los créditos de cualquier estudiante
 * mediante un modal con input numérico.
 */

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
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

interface Student {
  id: string;
  name: string;
  email: string;
  role: string;
  credits: number | null;
}

export default function AdminPrintingCreditsPage() {
  const { addToast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de edición de créditos
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [newCredits, setNewCredits] = useState("");
  const [saving, setSaving] = useState(false);

  // Cargar usuarios + créditos
  useEffect(() => {
    async function loadData() {
      try {
        // Cargar lista de usuarios
        const usersRes = await fetch("/api/admin/users");
        const usersData = await usersRes.json();
        const allUsers = (usersData.users ?? []) as Array<{
          id: string;
          name: string;
          email: string;
          role: string;
        }>;

        // Filtrar solo estudiantes
        const studentUsers = allUsers.filter((u) => u.role === "STUDENT");

        // Cargar créditos de cada estudiante en paralelo
        const withCredits = await Promise.all(
          studentUsers.map(async (u) => {
            try {
              const res = await fetch(`/api/printer/credits/${u.id}`);
              const data = await res.json();
              return { ...u, credits: data.availableCredits ?? null } as Student;
            } catch {
              return { ...u, credits: null } as Student;
            }
          }),
        );

        setStudents(withCredits);
        setFiltered(withCredits);
      } catch {
        addToast("Error al cargar datos", "danger");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [addToast]);

  /** Filtrar por nombre o email */
  function handleSearch(term: string) {
    if (!term) {
      setFiltered(students);
      return;
    }
    const lower = term.toLowerCase();
    setFiltered(
      students.filter(
        (s) =>
          s.name.toLowerCase().includes(lower) ||
          s.email.toLowerCase().includes(lower),
      ),
    );
  }

  /** Abrir modal para editar créditos */
  function openEdit(student: Student) {
    setEditStudent(student);
    setNewCredits(String(student.credits ?? 0));
  }

  /** Guardar nuevos créditos */
  async function handleSaveCredits() {
    if (!editStudent) return;

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
        body: JSON.stringify({ userId: editStudent.id, credits }),
      });

      const body = await res.json();

      if (!res.ok) {
        addToast(body.error ?? "Error al asignar créditos", "danger");
        return;
      }

      // Actualizar estado local
      const updatedCredits = body.credits ?? credits;
      setStudents((prev) =>
        prev.map((s) =>
          s.id === editStudent.id ? { ...s, credits: updatedCredits } : s,
        ),
      );
      setFiltered((prev) =>
        prev.map((s) =>
          s.id === editStudent.id ? { ...s, credits: updatedCredits } : s,
        ),
      );

      addToast(
        `Créditos de ${editStudent.name} actualizados a ${updatedCredits}`,
        "success",
      );
      setEditStudent(null);
    } catch {
      addToast("Error de conexión", "danger");
    } finally {
      setSaving(false);
    }
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
      <BackLink href="/admin/printing" label="Volver a impresión" />

      <div>
        <h1 className="text-2xl font-bold text-text">Créditos de impresión</h1>
        <p className="text-text-muted mt-1">
          Consulta y gestiona los créditos de impresión de los estudiantes.
        </p>
      </div>

      <SearchInput
        placeholder="Buscar estudiante por nombre o email..."
        onSearch={handleSearch}
        className="max-w-md"
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin estudiantes"
          description="No se encontraron estudiantes registrados."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Créditos</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell className="text-text-muted">{student.email}</TableCell>
                  <TableCell>
                    <Badge variant={student.credits === 0 ? "danger" : "info"}>
                      {student.credits ?? "—"}
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

      {/* Modal de edición de créditos */}
      <Modal
        open={editStudent !== null}
        onClose={() => setEditStudent(null)}
        title={`Créditos de ${editStudent?.name ?? ""}`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            Introduce la nueva cantidad de créditos para este estudiante.
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
            <Button variant="ghost" onClick={() => setEditStudent(null)}>
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
