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
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
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
  printer: { id: string; name: string; location: string };
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
        setTotalLogs(Math.max(totalLogs, offset + PAGE_SIZE + 1));
      }
    } catch {
      addToast("Error al cargar historial", "danger");
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/student/printing" label="Volver a impresión" />

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
                    onClick={() => router.push(`/dashboard/student/printing/history/${log.id}`)}
                  >
                    <TableCell className="text-text-muted text-sm whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {log.filename}
                    </TableCell>
                    <TableCell className="text-text-muted">{log.printer.name}</TableCell>
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
                      <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <path d="M7 17 17 7" />
                          <path d="M7 7h10v10" />
                        </svg>
                      </span>
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
