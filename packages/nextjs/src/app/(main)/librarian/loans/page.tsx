"use client";

import { useState } from "react";
import { useToast } from "@/hooks/useToast";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { FilterPills } from "@/components/ui/FilterPills";
import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { LOAN_STATUS_OPTIONS, type LoanStatusFilter } from "@/lib/library-constants";

const PAGE_SIZE = 20;
const RESERVATION_TIMEOUT_MS = 3 * 24 * 60 * 60 * 1000;

interface Loan {
  id: string; loanId: number; status: string;
  requestDate: string; reservationDate: string | null;
  dueDate: string | null;
  libraryItem: { title: string; type: string };
  user: { name: string; email: string };
}

export default function LibrarianLoansPage() {
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<LoanStatusFilter>("ALL");

  const list = usePaginatedList<Loan>({
    endpoint: "/api/library/loans",
    pageSize: PAGE_SIZE,
    filters: { status: statusFilter === "ALL" ? null : statusFilter },
    onError: () => addToast("Error al cargar préstamos", "danger"),
  });

  async function handleAction(loanId: string, action: "pickup" | "return" | "force-return" | "expire") {
    try {
      const res = await fetch(`/api/library/loans/${loanId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast("Acción realizada correctamente", "success");
      list.refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    }
  }

  function isReservationExpired(loan: Loan) {
    if (!loan.reservationDate) return false;
    return new Date().getTime() > new Date(loan.reservationDate).getTime() + RESERVATION_TIMEOUT_MS;
  }

  function isOverdue(loan: Loan) {
    return loan.dueDate ? new Date() > new Date(loan.dueDate) : false;
  }

  return (
    <div className="space-y-6">
      <BackLink href="/librarian" label="Volver al panel" />
      <div>
        <h1 className="text-2xl font-bold text-text">Préstamos</h1>
        {list.loading ? <Skeleton className="mt-2 h-4 w-56" /> : null}
      </div>

      {!list.loading && (
        <FilterPills
          options={LOAN_STATUS_OPTIONS}
          selected={statusFilter}
          onChange={setStatusFilter}
        />
      )}

      {list.loading && list.items.length === 0 ? (
        <SkeletonTable columns={6} rows={8} />
      ) : list.items.length === 0 ? (
        <EmptyState title="Sin préstamos" description="No hay préstamos con estos filtros." />
      ) : (
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
                            <Button size="sm" onClick={() => handleAction(loan.id, "pickup")}>Confirmar recogida</Button>
                            {isReservationExpired(loan) && (
                              <Button size="sm" variant="danger" onClick={() => handleAction(loan.id, "expire")}>Expirar</Button>
                            )}
                          </>}
                          {loan.status === "PICKED_UP" && <>
                            <Button size="sm" onClick={() => handleAction(loan.id, "return")}>Confirmar devolución</Button>
                            {isOverdue(loan) && (
                              <Button size="sm" variant="danger" onClick={() => handleAction(loan.id, "force-return")}>Forzar devolución</Button>
                            )}
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
    </div>
  );
}
