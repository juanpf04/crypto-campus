"use client";

/**
 * Vista de impresión del estudiante.
 *
 * Layout:
 * - Fila superior (50/50): Banner de créditos | Card clicable de historial
 * - Sección principal: Simulador de impresión completo dentro de una Card
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { icons } from "@/components/ui/icons";
import { LinkArrow } from "@/components/shared/LinkArrow";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { CreditsBanner } from "@/components/shared/CreditsBanner";
import { PrintingOverlay } from "@/components/shared/PrintingOverlay";
import { PrintJobForm, type PrintJobResult } from "@/components/forms/PrintJobForm";
import { formatCredits } from "@/lib/formatters";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";

interface Printer {
  id: string;
  name: string;
  location: string;
}

export default function StudentPrintingPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [credits, setCredits] = useState<number | null>(null);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [totalPrints, setTotalPrints] = useState(0);
  const [loading, setLoading] = useState(true);

  // Estado de la pantalla de impresión
  const [printingState, setPrintingState] = useState<{
    active: boolean;
    filename: string;
    promise: Promise<string | null> | null;
  }>({ active: false, filename: "", promise: null });

  // Carga inicial: créditos + impresoras + total de impresiones
  useEffect(() => {
    Promise.all([
      fetch("/api/printer/credits").then((r) => r.json()),
      fetch("/api/printer").then((r) => r.json()),
      fetch("/api/printer/logs?limit=200&offset=0").then((r) => r.json()),
    ])
      .then(([creditsData, printersData, logsData]) => {
        setCredits(creditsData.availableCredits ?? 0);
        setPrinters(printersData ?? []);
        setTotalPrints(Array.isArray(logsData) ? logsData.length : 0);
      })
        .catch(() => addToast("Error al cargar datos de impresión", "danger"))
        .finally(() => setLoading(false));
      }, [addToast]);

  // Ejecutar trabajo de impresión: crea una promise y activa el overlay
  function handlePrint(data: PrintJobResult) {
    const printPromise = fetch("/api/printer/execute", {
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
    }).then(async (res) => {
      const body = await res.json();
      if (!res.ok) {
        addToast(body.error ?? "Error al ejecutar impresión", "danger");
        return null;
      }
      setCredits(body.printLog?.creditsAfter ?? credits);
      setTotalPrints((prev) => prev + 1);
      return (body.printLog?.id as string) ?? null;
    }).catch(() => {
      addToast("Error al ejecutar impresión", "danger");
      return null;
    });

    // Activar overlay de impresión
    setPrintingState({ active: true, filename: data.filename, promise: printPromise });
  }

  // Cuando la animación y el backend terminan
  const handlePrintComplete = useCallback((logId: string | null) => {
    setPrintingState({ active: false, filename: "", promise: null });
    if (logId) {
      addToast("Impresión completada correctamente", "success");
      // replace para que "atrás" vuelva al formulario, no al overlay
      router.replace(`/librarian/printing/print/history/${logId}`);
    }
  }, [router, addToast]);

  if (loading) return <SkeletonPage />;

  // Si está imprimiendo, mostrar overlay en vez del formulario
  if (printingState.active && printingState.promise) {
    return (
      <PrintingOverlay
        filename={printingState.filename}
        printPromise={printingState.promise}
        onComplete={handlePrintComplete}
      />
    );
  }

  return (
    <div className="space-y-10">
      {/* ── 1. Fila superior: Créditos (50%) + Historial (50%) ── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Créditos */}
        <CreditsBanner
          icon={icons.print}
          value={formatCredits(credits ?? 0)}
          label="Créditos de impresión disponibles"
          hint="1 crédito = 1 cara impresa"
        />

        {/* Card clicable de historial */}
        <Link href="/librarian/printing/print/history" className="group">
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

            <LinkArrow />
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
