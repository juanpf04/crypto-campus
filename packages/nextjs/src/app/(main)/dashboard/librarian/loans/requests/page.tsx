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

interface LoanRequest {
  id: string; loanId: number; requestDate: string;
  libraryItem: { title: string; type: string };
  user: { name: string; email: string };
}

export default function LibrarianLoanRequestsPage() {
  const { addToast } = useToast();
  const [items, setItems] = useState<LoanRequest[]>([]);
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
      addToast("Error al cargar solicitudes", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast, offset]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  async function handleAction(id: string, action: "approve" | "reject") {
    setProcessing(id);
    try {
      const res = await fetch(`/api/library/loans/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ reason: "Rechazado por el bibliotecario" }) : "{}",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast(action === "approve" ? "Préstamo aprobado" : "Solicitud rechazada", "success");
      loadRequests();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setProcessing(null);
    }
  }

  if (loading && items.length === 0) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/librarian/loans" label="Volver a préstamos" />
      <div>
        <h1 className="text-2xl font-bold text-text">Solicitudes pendientes</h1>
        <p className="text-text-muted mt-1">{total} solicitud(es) pendientes de revisión</p>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Sin solicitudes" description="No hay solicitudes pendientes." />
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
                    <TableHead>Fecha solicitud</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.libraryItem.title}</TableCell>
                      <TableCell>{req.user.name}</TableCell>
                      <TableCell className="text-text-muted">{req.user.email}</TableCell>
                      <TableCell>{new Date(req.requestDate).toLocaleDateString("es-ES")}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAction(req.id, "approve")} loading={processing === req.id}>
                            Aprobar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleAction(req.id, "reject")} disabled={processing === req.id}>
                            Rechazar
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
