"use client";

/**
 * Vista de impresión del estudiante.
 *
 * Layout:
 * - Fila superior (50/50): Banner de créditos | Card clicable de historial
 * - Sección principal: Simulador de impresión completo dentro de una Card
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/useToast";
import { icons } from "@/lib/icons";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { CreditsBanner } from "@/components/shared/CreditsBanner";
import { PrintJobForm, type PrintJobResult } from "@/components/forms/PrintJobForm";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

interface Printer {
  id: string;
  name: string;
  location: string;
}

export default function StudentPrintingPage() {
  const { addToast } = useToast();

  const [credits, setCredits] = useState<number | null>(null);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [totalPrints, setTotalPrints] = useState(0);
  const [loading, setLoading] = useState(true);

  // Carga inicial: créditos + impresoras + contar logs del usuario
  useEffect(() => {
    Promise.all([
      fetch("/api/printer/credits").then((r) => r.json()),
      fetch("/api/printer").then((r) => r.json()),
      fetch("/api/printer/logs?limit=1&offset=0").then((r) => r.json()),
    ])
      .then(([creditsData, printersData, logsData]) => {
        setCredits(creditsData.availableCredits ?? 0);
        setPrinters(printersData ?? []);
        // Para obtener el total real necesitaríamos un endpoint de count,
        // por ahora usamos la longitud como indicador mínimo
        setTotalPrints(Array.isArray(logsData) ? logsData.length : 0);
      })
      .catch(() => addToast("Error al cargar datos de impresión", "danger"))
      .finally(() => setLoading(false));
  }, []);

  // Obtener total real de impresiones (haciendo fetch de todas con offset alto)
  useEffect(() => {
    if (loading) return;
    // Petición para estimar el total: pedimos un límite alto
    fetch("/api/printer/logs?limit=100&offset=0")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTotalPrints(data.length);
      })
      .catch(() => {});
  }, [loading]);

  // Ejecutar trabajo de impresión
  async function handlePrint(data: PrintJobResult) {
    const res = await fetch("/api/printer/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printerId: data.printerId,
        filename: data.filename,
        pages: data.pages,
        copies: data.copies,
        color: data.color,
        duplex: data.duplex,
        orientation: data.orientation,
        paperSize: data.paperSize,
        pageRangeFrom: data.pageRangeFrom,
        pageRangeTo: data.pageRangeTo,
        pagesPerSheet: data.pagesPerSheet,
        filePages: data.filePages,
        fileSize: data.fileSize,
        filePath: data.filePath,
      }),
    });

    const body = await res.json();

    if (!res.ok) {
      addToast(body.error ?? "Error al ejecutar impresión", "danger");
      throw new Error(body.error);
    }

    addToast("Impresión ejecutada correctamente", "success");

    // Actualizar créditos y contador
    setCredits(body.printLog?.creditsAfter ?? credits);
    setTotalPrints((prev) => prev + 1);
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
      {/* ── 1. Fila superior: Créditos (50%) + Historial (50%) ── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Créditos */}
        <CreditsBanner
          icon={icons.print}
          value={credits ?? "—"}
          label="Créditos de impresión disponibles"
          hint="1 crédito = 1 cara impresa"
        />

        {/* Card clicable de historial */}
        <Link href="/dashboard/student/printing/history" className="group">
          <Card className="flex items-center gap-4 h-full relative hover:border-primary/50 transition-colors">
            {/* Icono */}
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              {icons.history}
            </div>

            {/* Contenido */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-muted">Mis impresiones</p>
              <p className="text-3xl font-bold text-text">{totalPrints}</p>
              <p className="text-xs text-text-muted mt-0.5">Ver historial completo</p>
            </div>

            {/* Flecha ↗ indicando que es clicable */}
            <div className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </div>
          </Card>
        </Link>
      </section>

      {/* ── 2. Simulador de impresión ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.print}>Nueva impresión</SectionTitle>
        <Card>
          <CardHeader>
            <CardTitle>Simulador de impresión</CardTitle>
            <p className="text-sm text-text-muted">
              Selecciona un archivo, configura las opciones y envía a imprimir.
            </p>
          </CardHeader>
          <CardBody>
            <PrintJobForm
              printers={printers}
              availableCredits={credits ?? 0}
              onSubmit={handlePrint}
            />
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
