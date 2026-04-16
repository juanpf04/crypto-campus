"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

const PAGE_SIZE = 20;

interface Room {
  id: string; roomId: number; name: string; location: string | null; capacity: number; active: boolean;
}

export default function LibrarianRoomsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [items, setItems] = useState<Room[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        activeOnly: "false",
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const res = await fetch(`/api/rooms?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      addToast("Error al cargar salas", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast, offset]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  async function handleToggleActive(roomId: string, currentlyActive: boolean) {
    const action = currentlyActive ? "desactivar" : "reactivar";
    if (!confirm(`¿${currentlyActive ? "Desactivar" : "Reactivar"} esta sala?`)) return;
    try {
      if (currentlyActive) {
        const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Error al ${action} sala`);
      } else {
        const res = await fetch(`/api/rooms/${roomId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: true }),
        });
        if (!res.ok) throw new Error(`Error al ${action} sala`);
      }
      addToast(`Sala ${currentlyActive ? "desactivada" : "reactivada"}`, "success");
      loadRooms();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    }
  }

  if (loading && items.length === 0) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <BackLink href="/librarian" label="Volver al panel" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Salas de estudio</h1>
          <p className="text-text-muted mt-1">{total} sala(s) registradas</p>
        </div>
        <Button onClick={() => router.push("/librarian/rooms/new")}>Crear sala</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Sin salas" description="No hay salas registradas." />
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className={loading ? "opacity-50 transition-opacity" : ""}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Capacidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">{room.name}</TableCell>
                      <TableCell className="text-text-muted">{room.location || "—"}</TableCell>
                      <TableCell>{room.capacity} personas</TableCell>
                      <TableCell><StatusBadge status={room.active ? "ACTIVE" : "INACTIVE"} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="secondary" size="sm" onClick={() => router.push(`/librarian/rooms/${room.id}/edit`)}>
                            Editar
                          </Button>
                          <Button
                            variant={room.active ? "danger" : "success"}
                            size="sm"
                            onClick={() => handleToggleActive(room.id, room.active)}
                          >
                            {room.active ? "Desactivar" : "Reactivar"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
          <Pagination offset={offset} limit={PAGE_SIZE} total={total} onChange={setOffset} />
        </>
      )}
    </div>
  );
}
