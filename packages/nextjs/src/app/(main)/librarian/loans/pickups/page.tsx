"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
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
  const [items, setItems] = useState<PendingPickup[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      const res = await fetch(`/api/library/loans/requests?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      addToast("Error al cargar reservas", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast, offset]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

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
      loadRequests();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setProcessing(null);
    }
  }

  function isExpired(reservationDate: string | null) {
    if (!reservationDate) return false;
    return new Date().getTime() > new Date(reservationDate).getTime() + RESERVATION_TIMEOUT_MS;
  }

  if (loading && items.length === 0) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <BackLink href="/librarian" label="Volver al panel" />
      <div>
        <h1 className="text-2xl font-bold text-text">Reservas pendientes de recogida</h1>
        <p className="text-text-muted mt-1">{total} reserva(s) esperando recogida</p>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Sin reservas pendientes" description="No hay reservas esperando recogida." />
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className={loading ? "opacity-50 transition-opacity" : ""}>
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
                  {items.map((req) => (
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
                            <Button size="sm" variant="danger" onClick={() => handleAction(req.id, "expire")} disabled={processing === req.id}>
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
          <Pagination offset={offset} limit={PAGE_SIZE} total={total} onChange={setOffset} />
        </>
      )}
    </div>
  );
}
