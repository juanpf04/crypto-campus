"use client";

import { useState } from "react";
import { useToast } from "@/hooks/useToast";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

const PAGE_SIZE = 20;
const RESERVATION_TIMEOUT_MS = 3 * 24 * 60 * 60 * 1000;

interface PendingPickup {
  id: string; loanId: number; reservationDate: string | null;
  libraryItem: { title: string; type: string };
  user: { name: string; email: string };
}

export default function LibrarianPendingPickupsPage() {
  const { addToast } = useToast();
  const [processing, setProcessing] = useState<string | null>(null);

  const list = usePaginatedList<PendingPickup>({
    endpoint: "/api/library/loans/requests",
    pageSize: PAGE_SIZE,
    onError: () => addToast("Error al cargar reservas", "danger"),
  });

  const [pendingExpire, setPendingExpire] = useState<string | null>(null);
  const [submittingExpire, setSubmittingExpire] = useState(false);

  async function handleAction(id: string, action: "pickup" | "expire") {
    setProcessing(id);
    try {
      const res = await fetch(`/api/library/loans/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast(action === "pickup" ? "Recogida confirmada" : "Reserva expirada", "success");
      list.refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setProcessing(null);
    }
  }

  async function confirmExpire() {
    if (!pendingExpire) return;
    setSubmittingExpire(true);
    try {
      await handleAction(pendingExpire, "expire");
      setPendingExpire(null);
    } finally {
      setSubmittingExpire(false);
    }
  }

  function isExpired(reservationDate: string | null) {
    if (!reservationDate) return false;
    return new Date().getTime() > new Date(reservationDate).getTime() + RESERVATION_TIMEOUT_MS;
  }

  if (list.loading && list.items.length === 0) return <SkeletonTable columns={5} rows={6} />;

  return (
    <div className="space-y-6">
      <BackLink href="/librarian" label="Volver al panel" />
      <div>
        <h1 className="text-2xl font-bold text-text">Reservas pendientes de recogida</h1>
        <p className="text-text-muted mt-1">{list.total} reserva(s) esperando recogida</p>
      </div>

      {list.items.length === 0 ? (
        <EmptyState title="Sin reservas pendientes" description="No hay reservas esperando recogida." />
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className={list.loading ? "opacity-50 transition-opacity" : ""}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ítem</TableHead>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Reservado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.items.map((req) => (
                    <TableRow key={req.id} className={isExpired(req.reservationDate) ? "bg-danger/5" : ""}>
                      <TableCell className="font-medium">{req.libraryItem.title}</TableCell>
                      <TableCell>{req.user.name}</TableCell>
                      <TableCell className="text-text-muted">{req.user.email}</TableCell>
                      <TableCell>
                        {req.reservationDate
                          ? new Date(req.reservationDate).toLocaleDateString("es-ES")
                          : "—"}
                        {isExpired(req.reservationDate) && (
                          <span className="ml-2 text-xs text-danger font-medium">Expirada</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAction(req.id, "pickup")} loading={processing === req.id}>
                            Confirmar recogida
                          </Button>
                          {isExpired(req.reservationDate) && (
                            <Button size="sm" variant="danger" onClick={() => setPendingExpire(req.id)} disabled={processing === req.id}>
                              Expirar reserva
                            </Button>
                          )}
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
        open={pendingExpire !== null}
        onClose={() => { if (!submittingExpire) setPendingExpire(null); }}
        onConfirm={confirmExpire}
        title="Expirar reserva"
        description="La reserva quedará marcada como expirada y el ítem volverá a estar disponible. Esta acción no se puede deshacer."
        confirmLabel="Expirar"
        loading={submittingExpire}
      />
    </div>
  );
}
