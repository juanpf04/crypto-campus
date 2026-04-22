"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { LIBRARY_TYPE_OPTIONS, TYPE_LABELS, type LibraryTypeFilter } from "@/lib/library-constants";

const PAGE_SIZE = 20;

interface LibraryItem {
  id: string; tokenId: number; type: string; title: string;
  creator: string | null; category: string | null; totalCopies: number; active: boolean;
}

export default function AdminLibraryItemsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [typeFilter, setTypeFilter] = useState<LibraryTypeFilter>("ALL");

  const list = usePaginatedList<LibraryItem>({
    endpoint: "/api/library/items",
    pageSize: PAGE_SIZE,
    filters: {
      activeOnly: "false",
      type: typeFilter === "ALL" ? null : typeFilter,
    },
    onError: () => addToast("Error al cargar ítems", "danger"),
  });

  async function handleToggleActive(itemId: string, currentlyActive: boolean) {
    try {
      const res = await fetch(`/api/library/items/${itemId}`, { method: currentlyActive ? "DELETE" : "PATCH" });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast(currentlyActive ? "Ítem desactivado" : "Ítem reactivado", "success");
      list.refresh();
    } catch (err) { addToast(err instanceof Error ? err.message : "Error", "danger"); }
  }

  if (list.loading && list.items.length === 0) return <SkeletonTable columns={7} rows={6} />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/library" label="Volver a biblioteca" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Catálogo</h1>
          <p className="text-text-muted mt-1">{list.total} ítem(s)</p>
        </div>
        <Button onClick={() => router.push("/admin/library/items/new")}>Añadir ítem</Button>
      </div>
      <FilterPills options={LIBRARY_TYPE_OPTIONS} selected={typeFilter} onChange={setTypeFilter} />
      {list.items.length === 0 ? <EmptyState title="Sin ítems" description="No hay ítems con estos filtros." /> : (
        <>
          <Card className="overflow-hidden p-0">
            <div className={list.loading ? "opacity-50 transition-opacity" : ""}>
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
                  {list.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>{TYPE_LABELS[item.type] || item.type}</TableCell>
                      <TableCell className="text-text-muted">{item.creator || "—"}</TableCell>
                      <TableCell className="text-text-muted">{item.category || "—"}</TableCell>
                      <TableCell>{item.totalCopies}</TableCell>
                      <TableCell><StatusBadge status={item.active ? "ACTIVE" : "INACTIVE"} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="secondary" size="sm" onClick={() => router.push(`/admin/library/items/${item.id}/edit`)}>Editar</Button>
                          <Button variant={item.active ? "danger" : "success"} size="sm" onClick={() => handleToggleActive(item.id, item.active)}>
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
          <Pagination offset={list.offset} limit={list.limit} total={list.total} onChange={list.setOffset} />
        </>
      )}
    </div>
  );
}
