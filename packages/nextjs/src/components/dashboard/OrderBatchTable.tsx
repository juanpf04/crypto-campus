"use client";

/**
 * OrderBatchTable — Tabla de batches (pedidos agrupados) de la tienda.
 *
 * Usada tanto por admin como por student. Diferencias por prop:
 * - `showUser`: muestra columna Usuario (solo admin).
 * - `basePath`: URL base para navegar al detalle del batch.
 */

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { LinkArrow } from "@/components/shared/LinkArrow";
import { BatchStatusBadge } from "@/components/shared/BatchStatusBadge";
import { formatShortDate, formatItemSummary } from "@/lib/formatters";

export interface BatchTableItem {
  id: string;
  status: string;
  product: { name: string };
}

export interface BatchTableRow {
  id: string;
  purchaseDate: string;
  totalPaid: number;
  generalStatus: string;
  items: BatchTableItem[];
  user?: { name: string; email: string };
}

interface OrderBatchTableProps {
  batches: BatchTableRow[];
  /** URL base para navegar al detalle. Se concatena con `/${batchId}`. */
  basePath: string;
  showUser?: boolean;
}

export function OrderBatchTable({ batches, basePath, showUser = false }: OrderBatchTableProps) {
  const router = useRouter();

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            {showUser && <TableHead>Usuario</TableHead>}
            <TableHead>Artículos</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch) => {
            const summary = formatItemSummary(batch.items);
            return (
              <TableRow
                key={batch.id}
                className="cursor-pointer hover:bg-primary/5 transition-colors"
                onClick={() => router.push(`${basePath}/${batch.id}`)}
              >
                <TableCell className="text-text-muted text-sm whitespace-nowrap">
                  {formatShortDate(batch.purchaseDate)}
                </TableCell>
                {showUser && batch.user && (
                  <TableCell className="text-sm">
                    <span className="font-medium">{batch.user.name}</span>
                    <br />
                    <span className="text-text-muted text-xs">{batch.user.email}</span>
                  </TableCell>
                )}
                <TableCell>
                  <p className="font-medium text-text truncate max-w-[250px]">{summary}</p>
                  <p className="text-xs text-text-muted">{batch.items.length} artículo{batch.items.length !== 1 ? "s" : ""}</p>
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-primary">{batch.totalPaid} ShopTokens</span>
                </TableCell>
                <TableCell>
                  <BatchStatusBadge status={batch.generalStatus} />
                </TableCell>
                <TableCell>
                  <LinkArrow variant="static" size="sm" className="relative right-auto top-auto" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
