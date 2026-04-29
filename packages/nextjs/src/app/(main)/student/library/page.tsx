"use client";

/**
 * Página de biblioteca del ESTUDIANTE.
 * Catálogo de ítems disponibles + préstamos activos + enlace a salas.
 */

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { toastRewards } from "@/lib/rewardToast";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterPills } from "@/components/ui/FilterPills";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { LibraryItemCard } from "@/components/shared/LibraryItemCard";
import { LoanCard } from "@/components/shared/LoanCard";
import { NavCard } from "@/components/shared/NavCard";
import { icons } from "@/components/ui/icons";
import { LIBRARY_TYPE_OPTIONS, type LibraryTypeFilter } from "@/lib/library-constants";

interface LibraryItem {
  id: string; tokenId: number; type: string; title: string;
  creator: string | null; description: string | null; coverUrl: string | null;
  totalCopies: number;
}

interface MyLoan {
  id: string; loanId: number; status: string;
  dueDate: string | null; reservationDate: string | null;
  queuePosition: number | null;
  libraryItem: { title: string; creator: string | null };
}

export default function StudentLibraryPage() {
  const { addToast } = useToast();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [myLoans, setMyLoans] = useState<MyLoan[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [roomsCount, setRoomsCount] = useState<number | null>(null);
  const [printersCount, setPrintersCount] = useState<number | null>(null);
  const [printCredits, setPrintCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<LibraryTypeFilter>("ALL");
  const [requesting, setRequesting] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [itemsRes, balanceRes, roomsRes, printersRes, creditsRes] = await Promise.all([
        fetch("/api/library/items"),
        fetch("/api/library/balance").then((r) => r.json()).catch(() => ({ balance: 0 })),
        fetch("/api/rooms").then((r) => r.json()).catch(() => ({ total: 0 })),
        fetch("/api/printer").then((r) => r.json()).catch(() => []),
        fetch("/api/printer/credits").then((r) => r.json()).catch(() => ({ availableCredits: 0 })),
      ]);
      const itemsData = await itemsRes.json();
      setItems(itemsData.items ?? (Array.isArray(itemsData) ? itemsData : []));
      setBalance(balanceRes.balance ?? 0);
      setRoomsCount(roomsRes.total ?? (Array.isArray(roomsRes.items) ? roomsRes.items.length : 0));
      setPrintersCount(Array.isArray(printersRes) ? printersRes.length : 0);
      setPrintCredits(creditsRes.availableCredits ?? 0);
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
    // Pre-flight: cada préstamo requiere 1 Token como depósito.
    if ((balance ?? 0) < 1) {
      addToast("Necesitas al menos 1 Token de Préstamo para solicitar. Pide al admin que te asigne tokens.", "danger");
      return;
    }
    setRequesting(itemId);
    try {
      const res = await fetch("/api/library/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      addToast(data.queued ? "Te has unido a la cola de espera" : "Ítem reservado correctamente", "success");
      toastRewards(addToast, data.rewards);
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
      addToast("Préstamo cancelado", "success");
      loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    }
  }

  const filteredItems = items.filter((i) => typeFilter === "ALL" || i.type === typeFilter);
  const activeLoans = myLoans.filter((l) => l.status === "QUEUED" || l.status === "RESERVED" || l.status === "PICKED_UP");

  return (
    <div className="space-y-8">
      <BackLink href="/student" label="Volver al panel" />

      <div>
        <h1 className="text-2xl font-bold text-text">Biblioteca</h1>
        {!loading && balance !== null && (
          <p className="text-text-muted mt-1">{balance} Tokens de Préstamo disponibles</p>
        )}
        {loading && <Skeleton className="mt-2 h-4 w-56" />}
      </div>

      {/* ── Accesos destacados: Salas (2/3) + Impresiones (1/3) ── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <NavCard
          className="md:col-span-2"
          href="/student/library/rooms"
          icon={icons.rooms}
          label="Salas"
          title="Reservar sala de estudio"
          description={
            <>
              Reserva hoy hasta 4 horas en cualquiera de las{" "}
              <span className="font-semibold text-text">
                {loading || roomsCount === null ? "—" : roomsCount}
              </span>{" "}
              salas disponibles. Individuales y grupales.
            </>
          }
        />

        <NavCard
          href="/student/library/printing"
          icon={icons.print}
          label="Impresiones"
          title="Imprimir"
          description={
            <>
              <span className="font-semibold text-text">
                {loading || printCredits === null ? "—" : printCredits}
              </span>{" "}
              créditos disponibles
              {!loading && printersCount !== null && printersCount > 0 && (
                <> · {printersCount} impresoras</>
              )}
            </>
          }
        />
      </section>

      {/* ── Mis préstamos activos ── */}
      {loading ? (
        <section className="space-y-4" aria-busy="true" aria-live="polite">
          <SectionTitle icon={icons.loans}>Mis préstamos activos</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        </section>
      ) : activeLoans.length > 0 && (
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
                reservationDate={loan.reservationDate}
                queuePosition={loan.queuePosition}
                onCancel={() => handleCancelLoan(loan.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Catálogo ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.library}>Catálogo</SectionTitle>
        {!loading && <FilterPills options={LIBRARY_TYPE_OPTIONS} selected={typeFilter} onChange={setTypeFilter} />}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-live="polite">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
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
                hasTokens={(balance ?? 0) >= 1}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
