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
import { FilterPills } from "@/components/ui/FilterPills";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { LOAN_STATUS_OPTIONS, type LoanStatusFilter } from "@/lib/library-constants";

type DestructiveAction = "expire" | "force-return";

const ACTION_COPY: Record<DestructiveAction, { title: string; description: string; confirmLabel: string }> = {
  expire: {
    title: "Expirar reserva",
    description: "La reserva quedará marcada como expirada y el ítem volverá a estar disponible. Esta acción no se puede deshacer.",
    confirmLabel: "Expirar",
  },
  "force-return": {
    title: "Forzar devolución",
    description: "Marcarás el préstamo como devuelto en nombre del estudiante. Esta acción no se puede deshacer.",
    confirmLabel: "Forzar devolución",
  },
};

const PAGE_SIZE = 20;
const RESERVATION_TIMEOUT_MS = 3 * 24 * 60 * 60 * 1000;

interface Loan {
  id: string; loanId: number; status: string;
  requestDate: string; reservationDate: string | null;
  dueDate: string | null;
  libraryItem: { title: string; type: string };
  user: { name: string; email: string };
}

export default function AdminLoansPage() {
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<LoanStatusFilter>("ALL");

  const list = usePaginatedList<Loan>({
    endpoint: "/api/library/loans",
    pageSize: PAGE_SIZE,
    filters: { status: statusFilter === "ALL" ? null : statusFilter },
    onError: () => addToast("Error al cargar préstamos", "danger"),
  });

  const [pendingDestructive, setPendingDestructive] = useState<{ loanId: string; action: DestructiveAction } | null>(null);
  const [submittingDestructive, setSubmittingDestructive] = useState(false);
  // Bloquea doble-click en acciones positivas (pickup/return) que no van por modal
  const [processing, setProcessing] = useState<string | null>(null);

  async function handleAction(loanId: string, action: string) {
    setProcessing(loanId);
    try {
      const res = await fetch(`/api/library/loans/${loanId}/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast("Acción realizada", "success");
      list.refresh();
    } catch (err) { addToast(err instanceof Error ? err.message : "Error", "danger"); }
    finally { setProcessing(null); }
  }

  async function confirmDestructive() {
    if (!pendingDestructive) return;
    setSubmittingDestructive(true);
    try {
      await handleAction(pendingDestructive.loanId, pendingDestructive.action);
      setPendingDestructive(null);
    } finally {
      setSubmittingDestructive(false);
    }
  }

  function isReservationExpired(loan: Loan) {
    if (!loan.reservationDate) return false;
    return new Date().getTime() > new Date(loan.reservationDate).getTime() + RESERVATION_TIMEOUT_MS;
  }

  function isOverdue(loan: Loan) {
    return loan.dueDate ? new Date() > new Date(loan.dueDate) : false;
  }

  if (list.loading && list.items.length === 0) return <SkeletonTable columns={6} rows={6} />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/library" label="Volver a biblioteca" />
      <h1 className="text-2xl font-bold text-text">Préstamos</h1>
      <FilterPills options={LOAN_STATUS_OPTIONS} selected={statusFilter} onChange={setStatusFilter} />
      {list.items.length === 0 ? <EmptyState title="Sin préstamos" description="No hay préstamos con estos filtros." /> : (
        <>
          <Card className="overflow-hidden p-0">
            <div className={list.loading ? "opacity-50 transition-opacity" : ""}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ítem</TableHead>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Solicitado</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.items.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">{loan.libraryItem.title}</TableCell>
                      <TableCell className="text-text-muted">{loan.user.name}</TableCell>
                      <TableCell><StatusBadge status={loan.status} /></TableCell>
                      <TableCell>{new Date(loan.requestDate).toLocaleDateString("es-ES")}</TableCell>
                      <TableCell>{loan.dueDate ? new Date(loan.dueDate).toLocaleDateString("es-ES") : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {loan.status === "RESERVED" && <>
                            <Button size="sm" onClick={() => handleAction(loan.id, "pickup")} loading={processing === loan.id} disabled={processing !== null && processing !== loan.id}>Confirmar recogida</Button>
                            {isReservationExpired(loan) &&
                              <Button size="sm" variant="danger" onClick={() => setPendingDestructive({ loanId: loan.id, action: "expire" })} disabled={processing !== null}>Expirar</Button>}
                          </>}
                          {loan.status === "PICKED_UP" && <>
                            <Button size="sm" onClick={() => handleAction(loan.id, "return")} loading={processing === loan.id} disabled={processing !== null && processing !== loan.id}>Confirmar devolución</Button>
                            {isOverdue(loan) &&
                              <Button size="sm" variant="danger" onClick={() => setPendingDestructive({ loanId: loan.id, action: "force-return" })} disabled={processing !== null}>Forzar devolución</Button>}
                          </>}
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
        open={pendingDestructive !== null}
        onClose={() => { if (!submittingDestructive) setPendingDestructive(null); }}
        onConfirm={confirmDestructive}
        title={pendingDestructive ? ACTION_COPY[pendingDestructive.action].title : ""}
        description={pendingDestructive ? ACTION_COPY[pendingDestructive.action].description : ""}
        confirmLabel={pendingDestructive ? ACTION_COPY[pendingDestructive.action].confirmLabel : "Confirmar"}
        loading={submittingDestructive}
      />
    </div>
  );
}
