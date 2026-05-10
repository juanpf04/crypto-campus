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

interface LoanRequest {
  id: string; loanId: number; requestDate: string;
  libraryItem: { title: string; type: string };
  user: { name: string; email: string };
}

export default function AdminLoanRequestsPage() {
  const { addToast } = useToast();
  const [processing, setProcessing] = useState<string | null>(null);

  const list = usePaginatedList<LoanRequest>({
    endpoint: "/api/library/loans/requests",
    pageSize: PAGE_SIZE,
    onError: (msg) => addToast(msg, "danger"),
  });

  const [pendingReject, setPendingReject] = useState<{ id: string; title: string } | null>(null);

  async function handleAction(id: string, action: "approve" | "reject") {
    setProcessing(id);
    try {
      const res = await fetch(`/api/library/loans/${id}/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ reason: "Rechazado" }) : "{}",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast(action === "approve" ? "Aprobado" : "Rechazado", "success");
      list.refresh();
    } catch (err) { addToast(err instanceof Error ? err.message : "Error", "danger"); }
    finally { setProcessing(null); }
  }

  async function confirmReject() {
    if (!pendingReject) return;
    const id = pendingReject.id;
    setPendingReject(null);
    await handleAction(id, "reject");
  }

  if (list.loading && list.items.length === 0) return <SkeletonTable columns={5} rows={6} />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/library/loans" label="Volver a préstamos" />
      <div>
        <h1 className="text-2xl font-bold text-text">Solicitudes pendientes</h1>
        <p className="text-text-muted mt-1">{list.total} solicitud(es)</p>
      </div>
      {list.items.length === 0 ? <EmptyState title="Sin solicitudes" description="No hay solicitudes pendientes." /> : (
        <>
          <Card className="overflow-hidden p-0">
            <div className={list.loading ? "opacity-50 transition-opacity" : ""}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ítem</TableHead>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.items.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.libraryItem.title}</TableCell>
                      <TableCell>{req.user.name}</TableCell>
                      <TableCell className="text-text-muted">{req.user.email}</TableCell>
                      <TableCell>{new Date(req.requestDate).toLocaleDateString("es-ES")}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAction(req.id, "approve")} loading={processing === req.id}>Aprobar</Button>
                          <Button size="sm" variant="danger" onClick={() => setPendingReject({ id: req.id, title: req.libraryItem.title })} disabled={processing === req.id}>Rechazar</Button>
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
        open={pendingReject !== null}
        onClose={() => { if (processing === null) setPendingReject(null); }}
        onConfirm={confirmReject}
        title="Rechazar solicitud"
        description={
          pendingReject
            ? `La solicitud de "${pendingReject.title}" será rechazada. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Rechazar"
        loading={processing === pendingReject?.id}
      />
    </div>
  );
}
