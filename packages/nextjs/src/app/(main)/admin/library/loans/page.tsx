"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { FilterPills } from "@/components/ui/FilterPills";
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

export default function AdminLoansPage() {
  const { addToast } = useToast();
  const [items, setItems] = useState<Loan[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<LoanStatusFilter>("ALL");

  const loadLoans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res = await fetch(`/api/library/loans?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch { addToast("Error al cargar préstamos", "danger"); }
    finally { setLoading(false); }
  }, [addToast, offset, statusFilter]);

  useEffect(() => { loadLoans(); }, [loadLoans]);

  async function handleAction(loanId: string, action: string) {
    try {
      const res = await fetch(`/api/library/loans/${loanId}/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast("Acción realizada", "success");
      loadLoans();
    } catch (err) { addToast(err instanceof Error ? err.message : "Error", "danger"); }
  }

  function isReservationExpired(loan: Loan) {
    if (!loan.reservationDate) return false;
    return new Date().getTime() > new Date(loan.reservationDate).getTime() + RESERVATION_TIMEOUT_MS;
  }

  function isOverdue(loan: Loan) {
    return loan.dueDate ? new Date() > new Date(loan.dueDate) : false;
  }

  if (loading && items.length === 0) return <SkeletonTable columns={6} rows={6} />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/library" label="Volver a biblioteca" />
      <h1 className="text-2xl font-bold text-text">Préstamos</h1>
      <FilterPills options={LOAN_STATUS_OPTIONS} selected={statusFilter} onChange={(v) => { setStatusFilter(v); setOffset(0); }} />
      {items.length === 0 ? <EmptyState title="Sin préstamos" description="No hay préstamos con estos filtros." /> : (
        <>
          <Card className="overflow-hidden p-0">
            <div className={loading ? "opacity-50 transition-opacity" : ""}>
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
                  {items.map((loan) => (
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
                            {isReservationExpired(loan) &&
                              <Button size="sm" variant="danger" onClick={() => handleAction(loan.id, "expire")}>Expirar</Button>}
                          </>}
                          {loan.status === "PICKED_UP" && <>
                            <Button size="sm" onClick={() => handleAction(loan.id, "return")}>Confirmar devolución</Button>
                            {isOverdue(loan) &&
                              <Button size="sm" variant="danger" onClick={() => handleAction(loan.id, "force-return")}>Forzar devolución</Button>}
                          </>}
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
