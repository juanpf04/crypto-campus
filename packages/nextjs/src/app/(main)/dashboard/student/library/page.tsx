"use client";

/**
 * Página de biblioteca del ESTUDIANTE.
 * Catálogo de ítems disponibles + préstamos activos + enlace a salas.
 */

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterPills } from "@/components/ui/FilterPills";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { LibraryItemCard } from "@/components/shared/LibraryItemCard";
import { LoanCard } from "@/components/shared/LoanCard";
import { icons } from "@/components/ui/icons";
import { LIBRARY_TYPE_OPTIONS, type LibraryTypeFilter } from "@/lib/library-constants";
import Link from "next/link";

interface LibraryItem {
  id: string; tokenId: number; type: string; title: string;
  creator: string | null; description: string | null; coverUrl: string | null;
  totalCopies: number;
}

interface MyLoan {
  id: string; loanId: number; status: string; dueDate: string | null;
  libraryItem: { title: string; creator: string | null };
}

export default function StudentLibraryPage() {
  const { addToast } = useToast();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [myLoans, setMyLoans] = useState<MyLoan[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<LibraryTypeFilter>("ALL");
  const [requesting, setRequesting] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [itemsRes, balanceRes] = await Promise.all([
        fetch("/api/library/items"),
        fetch("/api/library/balance").then((r) => r.json()).catch(() => ({ balance: 0 })),
      ]);
      const itemsData = await itemsRes.json();
      setItems(itemsData.items ?? (Array.isArray(itemsData) ? itemsData : []));
      setBalance(balanceRes.balance ?? 0);
    } catch { /* no-op */ }

    try {
      const res = await fetch("/api/library/loans/my");
      const data = await res.json();
      setMyLoans(Array.isArray(data) ? data : []);
    } catch { /* no-op */ }

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleRequestLoan(itemId: string) {
    setRequesting(itemId);
    try {
      const res = await fetch("/api/library/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast("Préstamo solicitado correctamente", "success");
      loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al solicitar préstamo", "danger");
    } finally {
      setRequesting(null);
    }
  }

  async function handleCancelLoan(loanId: string) {
    try {
      const res = await fetch(`/api/library/loans/${loanId}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast("Solicitud cancelada", "success");
      loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    }
  }

  const filteredItems = items.filter((i) => typeFilter === "ALL" || i.type === typeFilter);
  const activeLoans = myLoans.filter((l) => l.status === "REQUESTED" || l.status === "APPROVED");

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-8">
      <BackLink href="/dashboard/student" label="Volver al panel" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Biblioteca</h1>
          {balance !== null && (
            <p className="text-text-muted mt-1">{balance} LibraryTokens disponibles</p>
          )}
        </div>
        <Link href="/dashboard/student/library/rooms">
          <Button>
            <span className="flex items-center gap-2">{icons.rooms} Reservar sala</span>
          </Button>
        </Link>
      </div>

      {/* ── Mis préstamos activos ── */}
      {activeLoans.length > 0 && (
        <section className="space-y-4">
          <SectionTitle icon={icons.loans}>Mis préstamos activos</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeLoans.map((loan) => (
              <LoanCard
                key={loan.id}
                title={loan.libraryItem.title}
                creator={loan.libraryItem.creator}
                status={loan.status}
                dueDate={loan.dueDate}
                cancellable={loan.status === "REQUESTED"}
                onCancel={() => handleCancelLoan(loan.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Catálogo ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.library}>Catálogo</SectionTitle>
        <FilterPills options={LIBRARY_TYPE_OPTIONS} selected={typeFilter} onChange={setTypeFilter} />

        {filteredItems.length === 0 ? (
          <EmptyState title="Sin ítems" description="No hay ítems disponibles con estos filtros." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <LibraryItemCard
                key={item.id}
                id={item.id}
                title={item.title}
                type={item.type}
                creator={item.creator}
                description={item.description}
                coverUrl={item.coverUrl}
                totalCopies={item.totalCopies}
                onRequestLoan={() => handleRequestLoan(item.id)}
                requesting={requesting === item.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
