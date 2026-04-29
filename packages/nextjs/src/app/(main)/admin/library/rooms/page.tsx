"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { InfoModal } from "@/components/shared/InfoModal";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

const PAGE_SIZE = 20;

interface Room {
  id: string; roomId: number; name: string; location: string | null; capacity: number; active: boolean;
  activeBookingCount: number;
}

export default function AdminRoomsPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const list = usePaginatedList<Room>({
    endpoint: "/api/rooms",
    pageSize: PAGE_SIZE,
    filters: { activeOnly: "false" },
    onError: () => addToast("Error", "danger"),
  });

  const [pending, setPending] = useState<{ id: string; name: string; currentlyActive: boolean } | null>(null);
  const [blocked, setBlocked] = useState<{ name: string; count: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function requestToggle(room: Room) {
    if (room.active && room.activeBookingCount > 0) {
      setBlocked({ name: room.name, count: room.activeBookingCount });
      return;
    }
    setPending({ id: room.id, name: room.name, currentlyActive: room.active });
  }

  async function confirmToggleActive() {
    if (!pending) return;
    const { id: roomId, currentlyActive } = pending;
    setSubmitting(true);
    try {
      if (currentlyActive) {
        const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Error al desactivar sala");
      } else {
        const res = await fetch(`/api/rooms/${roomId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: true }),
        });
        if (!res.ok) throw new Error("Error al reactivar sala");
      }
      addToast(`Sala ${currentlyActive ? "desactivada" : "reactivada"}`, "success");
      list.refresh();
      setPending(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  if (list.loading && list.items.length === 0) return <SkeletonTable columns={5} rows={6} />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/library" label="Volver a biblioteca" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Salas de estudio</h1>
          <p className="text-text-muted mt-1">{list.total} sala(s)</p>
        </div>
        <Button onClick={() => router.push("/admin/library/rooms/new")}>Crear sala</Button>
      </div>
      {list.items.length === 0 ? <EmptyState title="Sin salas" description="No hay salas." /> : (
        <>
          <Card className="overflow-hidden p-0">
            <div className={list.loading ? "opacity-50 transition-opacity" : ""}>
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
                  {list.items.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">{room.name}</TableCell>
                      <TableCell className="text-text-muted">{room.location || "—"}</TableCell>
                      <TableCell>{room.capacity} pers.</TableCell>
                      <TableCell><StatusBadge status={room.active ? "ACTIVE" : "INACTIVE"} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="secondary" onClick={() => router.push(`/admin/library/rooms/${room.id}/edit`)}>Editar</Button>
                          <Button
                            size="sm"
                            variant={room.active ? "danger" : "success"}
                            onClick={() => requestToggle(room)}
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
          <Pagination offset={list.offset} limit={list.limit} total={list.total} onChange={list.setOffset} />
        </>
      )}

      <ConfirmModal
        open={pending !== null}
        onClose={() => { if (!submitting) setPending(null); }}
        onConfirm={confirmToggleActive}
        title={pending?.currentlyActive ? "Desactivar sala" : "Reactivar sala"}
        description={
          pending?.currentlyActive
            ? `"${pending.name}" dejará de estar disponible para nuevas reservas. ¿Quieres continuar?`
            : `"${pending?.name}" volverá a estar disponible para reservas. ¿Quieres continuar?`
        }
        confirmLabel={pending?.currentlyActive ? "Desactivar" : "Reactivar"}
        loading={submitting}
      />

      <InfoModal
        open={blocked !== null}
        onClose={() => setBlocked(null)}
        title="No se puede desactivar"
        description={
          blocked
            ? `"${blocked.name}" tiene ${blocked.count} reserva${blocked.count !== 1 ? "s" : ""} activa${blocked.count !== 1 ? "s" : ""} para hoy y no se puede desactivar hasta que se cancelen o terminen.`
            : ""
        }
      />
    </div>
  );
}
