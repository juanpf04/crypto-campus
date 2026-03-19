"use client";

/**
 * Gestión de impresoras — Lista completa (activas e inactivas).
 *
 * Muestra tabla con todas las impresoras registradas.
 * El admin puede: añadir, editar, activar/desactivar (soft delete).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/useToast";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";

interface Printer {
  id: string;
  name: string;
  location: string;
  floor: string | null;
  active: boolean;
}

export default function PrintersListPage() {
  const { addToast } = useToast();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/printer/admin")
      .then((r) => r.json())
      .then((data) => setPrinters(data ?? []))
      .catch(() => addToast("Error al cargar impresoras", "danger"))
      .finally(() => setLoading(false));
  }, []);

  /** Activa o desactiva una impresora (soft delete) */
  async function toggleActive(printer: Printer) {
    setTogglingId(printer.id);
    try {
      const res = await fetch(`/api/printer/${printer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !printer.active }),
      });

      if (!res.ok) {
        const body = await res.json();
        addToast(body.error ?? "Error al actualizar impresora", "danger");
        return;
      }

      // Actualizar estado local
      setPrinters((prev) =>
        prev.map((p) => (p.id === printer.id ? { ...p, active: !p.active } : p)),
      );
      addToast(
        `Impresora ${!printer.active ? "activada" : "desactivada"} correctamente`,
        "success",
      );
    } catch {
      addToast("Error de conexión", "danger");
    } finally {
      setTogglingId(null);
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
      <BackLink href="/dashboard/admin/printing" label="Volver a impresión" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Impresoras</h1>
          <p className="text-text-muted mt-1">
            {printers.length} impresora{printers.length !== 1 && "s"} registrada{printers.length !== 1 && "s"}
          </p>
        </div>
        <Link href="/dashboard/admin/printing/printers/new">
          <Button>Añadir impresora</Button>
        </Link>
      </div>

      {/* Tabla */}
      {printers.length === 0 ? (
        <EmptyState
          title="Sin impresoras"
          description="No hay impresoras registradas en el sistema."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Planta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {printers.map((printer) => (
                <TableRow key={printer.id}>
                  <TableCell className="font-mono text-sm">{printer.id}</TableCell>
                  <TableCell className="font-medium">{printer.name}</TableCell>
                  <TableCell className="text-text-muted">{printer.location}</TableCell>
                  <TableCell className="text-text-muted">{printer.floor ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={printer.active ? "ACTIVE" : "INACTIVE"} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/admin/printing/printers/${printer.id}/edit`}>
                        <Button variant="outline" size="sm">
                          Editar
                        </Button>
                      </Link>
                      <Button
                        variant={printer.active ? "danger" : "primary"}
                        size="sm"
                        loading={togglingId === printer.id}
                        onClick={() => toggleActive(printer)}
                      >
                        {printer.active ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
