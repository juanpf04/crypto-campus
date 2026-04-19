"use client";

/**
 * Historial de impresiones del estudiante.
 *
 * Tabla paginada con todos los trabajos de impresión del usuario,
 * mostrando archivo, impresora, páginas, créditos usados y fecha.
 * Extraída de la vista principal para mantenerla limpia.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
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

  const [logs, setLogs] = useState<PrintLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/printer/logs?limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      setLogs(data ?? []);

      if (data.length < PAGE_SIZE) {
        setTotalLogs(offset + data.length);
      } else {
        setTotalLogs((prev) => Math.max(prev, offset + PAGE_SIZE + 1));
      }
    } catch {
      addToast("Error al cargar historial", "danger");
    } finally {
      setLoading(false);
    }
  }, [offset, addToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (loading) return <SkeletonTable columns={8} rows={8} />;

  return (
    <div className="space-y-6">
      <BackLink href="/student/library/printing" label="Volver a impresión" />

      <div>
        <h1 className="text-2xl font-bold text-text">Historial de impresiones</h1>
        <p className="text-text-muted mt-1">
          Todas las impresiones que has realizado.
        </p>
      </div>

      {logs.length === 0 ? (
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
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-primary/5 transition-colors"
                    onClick={() => router.push(`/student/library/printing/history/${log.id}`)}
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
            offset={offset}
            limit={PAGE_SIZE}
            total={totalLogs}
            onChange={setOffset}
          />
        </>
      )}
    </div>
  );
}
