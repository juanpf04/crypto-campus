"use client";

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
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

const PAGE_SIZE = 20;

interface Room {
  id: string; roomId: number; name: string; location: string | null; capacity: number; active: boolean;
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

  async function handleDelete(id: string) {
    if (!confirm("¿Desactivar esta sala?")) return;
    try {
      const res = await fetch(`/api/rooms/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      addToast("Sala desactivada", "success");
      list.refresh();
    } catch { addToast("Error", "danger"); }
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
                          {room.active && <Button size="sm" variant="danger" onClick={() => handleDelete(room.id)}>Desactivar</Button>}
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
    </div>
  );
}
