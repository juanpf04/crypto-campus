"use client";

/**
 * Vista de impresión del estudiante.
 *
 * Tres secciones verticales:
 * 1. Banner de créditos disponibles (lectura del contrato).
 * 2. Formulario para ejecutar un trabajo de impresión.
 * 3. Historial de impresiones propias con paginación.
 */

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { icons } from "@/lib/icons";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { CreditsBanner } from "@/components/shared/CreditsBanner";
import { PrintJobForm, type PrintJobFormData } from "@/components/forms/PrintJobForm";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";

interface Printer {
  id: string;
  name: string;
  location: string;
}

interface PrintLog {
  id: string;
  filename: string;
  pages: number;
  creditsUsed: number;
  creditsAfter: number;
  txHash: string;
  createdAt: string;
  printer: { id: string; name: string; location: string };
}

const PAGE_SIZE = 10;

export default function StudentPrintingPage() {
  const { addToast } = useToast();

  // -- Estado --
  const [credits, setCredits] = useState<number | null>(null);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [logs, setLogs] = useState<PrintLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  // -- Carga inicial: créditos + impresoras + logs --
  useEffect(() => {
    Promise.all([
      fetch("/api/printer/credits").then((r) => r.json()),
      fetch("/api/printer").then((r) => r.json()),
      fetch(`/api/printer/logs?limit=${PAGE_SIZE}&offset=0`).then((r) => r.json()),
    ])
      .then(([creditsData, printersData, logsData]) => {
        setCredits(creditsData.availableCredits ?? 0);
        setPrinters(printersData ?? []);
        setLogs(logsData ?? []);
        // Estimamos el total: si devuelve exactamente PAGE_SIZE, probablemente hay más
        setTotalLogs(logsData.length === PAGE_SIZE ? PAGE_SIZE + 1 : logsData.length);
      })
      .catch(() => addToast("Error al cargar datos de impresión", "danger"))
      .finally(() => setLoading(false));
  }, []);

  // -- Recarga de logs al cambiar de página --
  useEffect(() => {
    if (loading) return;
    fetch(`/api/printer/logs?limit=${PAGE_SIZE}&offset=${offset}`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data ?? []);
        // Si hay menos de PAGE_SIZE, estamos en la última página
        if (data.length < PAGE_SIZE) {
          setTotalLogs(offset + data.length);
        } else {
          // Podría haber más → mantenemos el total estimado
          setTotalLogs(Math.max(totalLogs, offset + PAGE_SIZE + 1));
        }
      })
      .catch(() => addToast("Error al cargar historial", "danger"));
  }, [offset]);

  // -- Ejecutar trabajo de impresión --
  async function handlePrint(data: PrintJobFormData) {
    const res = await fetch("/api/printer/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printerId: data.printerId,
        filename: data.filename,
        pages: Number(data.pages),
        copies: Number(data.copies),
      }),
    });

    const body = await res.json();

    if (!res.ok) {
      addToast(body.error ?? "Error al ejecutar impresión", "danger");
      throw new Error(body.error);
    }

    addToast("Impresión ejecutada correctamente", "success");

    // Refrescar créditos y logs
    setCredits(body.printLog?.creditsAfter ?? credits);
    setOffset(0);
    const logsRes = await fetch(`/api/printer/logs?limit=${PAGE_SIZE}&offset=0`);
    const logsData = await logsRes.json();
    setLogs(logsData ?? []);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── 1. Créditos disponibles ── */}
      <section>
        <CreditsBanner
          icon={icons.print}
          value={credits ?? "—"}
          label="Créditos de impresión disponibles"
          hint="1 crédito = 1 página impresa"
        />
      </section>

      {/* ── 2. Formulario de impresión ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.print}>Nueva impresión</SectionTitle>
        <Card>
          <CardHeader>
            <CardTitle>Ejecutar trabajo de impresión</CardTitle>
            <p className="text-sm text-text-muted">
              Selecciona la impresora y los detalles del documento a imprimir.
            </p>
          </CardHeader>
          <CardBody>
            <PrintJobForm printers={printers} onSubmit={handlePrint} />
          </CardBody>
        </Card>
      </section>

      {/* ── 3. Historial de impresiones ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.orders}>Historial de impresiones</SectionTitle>

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
                    <TableHead>Archivo</TableHead>
                    <TableHead>Impresora</TableHead>
                    <TableHead>Páginas</TableHead>
                    <TableHead>Créditos</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.filename}</TableCell>
                      <TableCell className="text-text-muted">{log.printer.name}</TableCell>
                      <TableCell>{log.pages}</TableCell>
                      <TableCell className="text-text-muted">{log.creditsUsed}</TableCell>
                      <TableCell className="text-text-muted text-sm">
                        {new Date(log.createdAt).toLocaleDateString("es-ES")}
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
      </section>
    </div>
  );
}
