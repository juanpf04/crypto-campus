"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { FilterPills } from "@/components/ui/FilterPills";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { LIBRARY_TYPE_OPTIONS, TYPE_LABELS, type LibraryTypeFilter } from "@/lib/library-constants";

const PAGE_SIZE = 20;

interface LibraryItem {
  id: string; tokenId: number; type: string; title: string;
  creator: string | null; category: string | null; totalCopies: number; active: boolean;
}

export default function LibrarianItemsPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [items, setItems] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<LibraryTypeFilter>("ALL");

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        activeOnly: "false",
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (typeFilter !== "ALL") params.set("type", typeFilter);

      const res = await fetch(`/api/library/items?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      addToast("Error al cargar ítems", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast, offset, typeFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function handleToggleActive(itemId: string, currentlyActive: boolean) {
    try {
      const method = currentlyActive ? "DELETE" : "PATCH";
      const res = await fetch(`/api/library/items/${itemId}`, { method });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast(currentlyActive ? "Ítem desactivado" : "Ítem reactivado", "success");
      loadItems();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    }
  }

  if (loading && items.length === 0) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/librarian" label="Volver al panel" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Catálogo</h1>
          <p className="text-text-muted mt-1">{total} ítem(s) registrados</p>
        </div>
        <Button onClick={() => router.push("/dashboard/librarian/items/new")}>Añadir ítem</Button>
      </div>

      <FilterPills
        options={LIBRARY_TYPE_OPTIONS}
        selected={typeFilter}
        onChange={(v) => { setTypeFilter(v); setOffset(0); }}
      />

      {items.length === 0 ? (
        <EmptyState title="Sin ítems" description="No hay ítems con estos filtros." />
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className={loading ? "opacity-50 transition-opacity" : ""}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Autor</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Copias</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>{TYPE_LABELS[item.type] || item.type}</TableCell>
                      <TableCell className="text-text-muted">{item.creator || "—"}</TableCell>
                      <TableCell className="text-text-muted">{item.category || "—"}</TableCell>
                      <TableCell>{item.totalCopies}</TableCell>
                      <TableCell><StatusBadge status={item.active ? "ACTIVE" : "INACTIVE"} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/librarian/items/${item.id}/edit`)}>
                            Editar
                          </Button>
                          <Button
                            variant={item.active ? "ghost" : "outline"}
                            size="sm"
                            onClick={() => handleToggleActive(item.id, item.active)}
                          >
                            {item.active ? "Desactivar" : "Reactivar"}
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
