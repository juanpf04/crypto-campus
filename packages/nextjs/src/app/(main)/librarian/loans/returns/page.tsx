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

interface ActiveLoan {
  id: string; loanId: number; dueDate: string | null;
  libraryItem: { title: string; type: string };
  user: { name: string; email: string };
}

export default function LibrarianPendingReturnsPage() {
  const { addToast } = useToast();
  const [processing, setProcessing] = useState<string | null>(null);

  const list = usePaginatedList<ActiveLoan>({
    endpoint: "/api/library/loans",
    pageSize: PAGE_SIZE,
    filters: { status: "PICKED_UP" },
    onError: () => addToast("Error al cargar préstamos", "danger"),
  });

  const [pendingForceReturn, setPendingForceReturn] = useState<string | null>(null);
  const [submittingForce, setSubmittingForce] = useState(false);

  async function handleAction(id: string, action: "return" | "force-return") {
    setProcessing(id);
    try {
      const res = await fetch(`/api/library/loans/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast(action === "return" ? "Devolución confirmada" : "Devolución forzada", "success");
      list.refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setProcessing(null);
    }
  }

  async function confirmForceReturn() {
    if (!pendingForceReturn) return;
    setSubmittingForce(true);
    try {
      await handleAction(pendingForceReturn, "force-return");
      setPendingForceReturn(null);
    } finally {
      setSubmittingForce(false);
    }
  }

  function isOverdue(dueDate: string | null) {
    return dueDate ? new Date() > new Date(dueDate) : false;
  }

  if (list.loading && list.items.length === 0) return <SkeletonTable columns={5} rows={6} />;

  return (
    <div className="space-y-6">
      <BackLink href="/librarian" label="Volver al panel" />
      <div>
        <h1 className="text-2xl font-bold text-text">Devoluciones pendientes</h1>
        <p className="text-text-muted mt-1">{list.total} préstamo(s) activos esperando devolución</p>
      </div>

      {list.items.length === 0 ? (
        <EmptyState title="Sin devoluciones pendientes" description="No hay préstamos activos esperando devolución." />
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
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.items.map((loan) => (
                    <TableRow key={loan.id} className={isOverdue(loan.dueDate) ? "bg-danger/5" : ""}>
                      <TableCell className="font-medium">{loan.libraryItem.title}</TableCell>
                      <TableCell>{loan.user.name}</TableCell>
                      <TableCell className="text-text-muted">{loan.user.email}</TableCell>
                      <TableCell>
                        {loan.dueDate
                          ? new Date(loan.dueDate).toLocaleDateString("es-ES")
                          : "—"}
                        {isOverdue(loan.dueDate) && (
                          <span className="ml-2 text-xs text-danger font-medium">Vencido</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAction(loan.id, "return")} loading={processing === loan.id}>
                            Confirmar devolución
                          </Button>
                          {isOverdue(loan.dueDate) && (
                            <Button size="sm" variant="danger" onClick={() => setPendingForceReturn(loan.id)} disabled={processing === loan.id}>
                              Forzar devolución
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
        open={pendingForceReturn !== null}
        onClose={() => { if (!submittingForce) setPendingForceReturn(null); }}
        onConfirm={confirmForceReturn}
        title="Forzar devolución"
        description="Marcarás el préstamo como devuelto en nombre del estudiante. Esta acción no se puede deshacer."
        confirmLabel="Forzar devolución"
        loading={submittingForce}
      />
    </div>
  );
}
