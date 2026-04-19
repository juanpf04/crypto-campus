"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
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
  const [items, setItems] = useState<ActiveLoan[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const loadLoans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "PICKED_UP", limit: String(PAGE_SIZE), offset: String(offset) });
      const res = await fetch(`/api/library/loans?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      addToast("Error al cargar préstamos", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast, offset]);

  useEffect(() => { loadLoans(); }, [loadLoans]);

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
      loadLoans();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setProcessing(null);
    }
  }

  function isOverdue(dueDate: string | null) {
    return dueDate ? new Date() > new Date(dueDate) : false;
  }

  if (loading && items.length === 0) return <SkeletonTable columns={5} rows={6} />;

  return (
    <div className="space-y-6">
      <BackLink href="/librarian" label="Volver al panel" />
      <div>
        <h1 className="text-2xl font-bold text-text">Devoluciones pendientes</h1>
        <p className="text-text-muted mt-1">{total} préstamo(s) activos esperando devolución</p>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Sin devoluciones pendientes" description="No hay préstamos activos esperando devolución." />
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
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((loan) => (
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
                            <Button size="sm" variant="danger" onClick={() => handleAction(loan.id, "force-return")} disabled={processing === loan.id}>
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
          <Pagination offset={offset} limit={PAGE_SIZE} total={total} onChange={setOffset} />
        </>
      )}
    </div>
  );
}
