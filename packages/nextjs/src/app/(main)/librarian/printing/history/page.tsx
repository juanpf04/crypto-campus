"use client";

/**
 * Historial de impresiones del usuario (librarian).
 * Tabla paginada con todos los trabajos realizados.
 */

import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { LinkArrow } from "@/components/shared/LinkArrow";
import { formatShortDate } from "@/lib/formatters";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";

interface PrintLog {
  id: string;
  filename: string;
  pages: number;
  copies: number;
  creditsUsed: number;
  creditsAfter: number;
  color: boolean;
  duplex: boolean;
  orientation: string;
  paperSize: string;
  txHash: string;
  createdAt: string;
  printer: { id: string; location: string };
}

const PAGE_SIZE = 10;

export default function StudentPrintHistoryPage() {
  const router = useRouter();
  const { addToast } = useToast();

  // El endpoint devuelve un array sin `total`; estimamos el total en base a
  // si la página actual está llena (probablemente hay más) o no.
  const list = usePaginatedList<PrintLog>({
    endpoint: "/api/printer/logs",
    pageSize: PAGE_SIZE,
    onError: () => addToast("Error al cargar historial", "danger"),
    parseResponse: (data, offset, limit) => {
      const items = Array.isArray(data) ? (data as PrintLog[]) : [];
      const total = items.length < limit ? offset + items.length : offset + limit + 1;
      return { items, total };
    },
  });

  if (list.loading) return <SkeletonTable columns={8} rows={8} />;

  return (
    <div className="space-y-6">
      <BackLink href="/librarian/printing/print" label="Volver a impresión" />

      <div>
        <h1 className="text-2xl font-bold text-text">Historial de impresiones</h1>
        <p className="text-text-muted mt-1">
          Todas las impresiones que has realizado.
        </p>
      </div>

      {list.items.length === 0 ? (
        <EmptyState
          title="Sin impresiones"
          description="Aún no has realizado ninguna impresión."
        />
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Impresora</TableHead>
                  <TableHead>Páginas</TableHead>
                  <TableHead>Copias</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Créditos</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.items.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-primary/5 transition-colors"
                    onClick={() => router.push(`/librarian/printing/print/history/${log.id}`)}
                  >
                    <TableCell className="text-text-muted text-sm whitespace-nowrap">
                      {formatShortDate(log.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {log.filename}
                    </TableCell>
                    <TableCell className="text-text-muted">{log.printer.id}</TableCell>
                    <TableCell>{log.pages}</TableCell>
                    <TableCell>{log.copies}</TableCell>
                    <TableCell>
                      <Badge variant={log.color ? "info" : "neutral"}>
                        {log.color ? "Color" : "B/N"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="warning">{log.creditsUsed}</Badge>
                    </TableCell>
                    <TableCell>
                      <LinkArrow variant="static" size="sm" className="relative right-auto top-auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Pagination
            offset={list.offset}
            limit={list.limit}
            total={list.total}
            onChange={list.setOffset}
          />
        </>
      )}
    </div>
  );
}
