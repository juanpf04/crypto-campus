"use client";

/**
 * PrintingHomeView — Vista principal de impresión, parametrizada por rol.
 *
 * Layout:
 * - (opcional) BackLink al espacio padre
 * - Fila superior (50/50): Banner de créditos | Card clicable de historial
 * - Sección principal: Simulador de impresión completo dentro de una Card
 *
 * Reutilizado por estudiante (`/student/library/printing`) y profesor
 * (`/professor/printing`). Las únicas diferencias son `basePath` (para los
 * enlaces internos) y el `parentLink` opcional (BackLink superior).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { toastRewards } from "@/lib/rewardToast";
import type { RewardGrant } from "@/lib/shopRewardsMeta";
import { icons } from "@/components/ui/icons";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { CreditsBanner } from "@/components/shared/CreditsBanner";
import { NavCard } from "@/components/shared/NavCard";
import { PrintingOverlay } from "@/components/shared/PrintingOverlay";
import { PrintJobForm, type PrintJobResult } from "@/components/forms/PrintJobForm";
import { BackLink } from "@/components/ui/BackLink";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { formatCredits } from "@/lib/formatters";

interface Printer {
  id: string;
  name: string;
  location: string;
}

interface PrintingHomeViewProps {
  /** Prefijo de URL para las rutas internas de impresión (e.g. "/student/library/printing"). */
  basePath: string;
  /** Si se pasa, se muestra un BackLink superior hacia esa ruta. */
  parentLink?: { href: string; label: string };
}

export function PrintingHomeView({ basePath, parentLink }: PrintingHomeViewProps) {
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

  // Recompensas del último trabajo, pendientes de toastear cuando acabe el overlay
  const pendingRewardsRef = useRef<RewardGrant[]>([]);

  // Carga inicial: créditos + impresoras + total de impresiones.
  // /api/printer/logs devuelve { items, total } (con count real). Pedimos
  // limit=1 porque solo necesitamos el total, no los items.
  useEffect(() => {
    Promise.all([
      fetch("/api/printer/credits").then((r) => r.json()),
      fetch("/api/printer").then((r) => r.json()),
      fetch("/api/printer/logs?limit=1&offset=0").then((r) => r.json()),
    ])
      .then(([creditsData, printersData, logsData]) => {
        setCredits(creditsData.availableCredits ?? 0);
        setPrinters(printersData ?? []);
        const total =
          typeof logsData?.total === "number"
            ? logsData.total
            : Array.isArray(logsData)
              ? logsData.length
              : 0;
        setTotalPrints(total);
      })
      .catch(() => addToast("Error al cargar datos de impresión", "danger"))
      .finally(() => setLoading(false));
  }, [addToast]);

  // Ejecutar trabajo de impresión: crea una promise y activa el overlay.
  // Si la operación falla muy rápido (ej. módulo pausado, validación de
  // backend), no llegamos a mostrar el overlay — el toast de error basta.
  function handlePrint(data: PrintJobResult) {
    let failed = false;

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
        failed = true;
        addToast(body.error ?? "Error al ejecutar impresión", "danger");
        return null;
      }
      setCredits(body.printLog?.creditsAfter ?? credits);
      setTotalPrints((prev) => prev + 1);
      pendingRewardsRef.current = body.rewards ?? [];
      return (body.printLog?.id as string) ?? null;
    }).catch(() => {
      failed = true;
      addToast("Error al ejecutar impresión", "danger");
      return null;
    });

    // Si la promise ya falló antes de 400ms (ej. módulo pausado), no
    // mostramos el overlay — el toast ya informa al usuario. Si todavía
    // está en curso al pasar ese tiempo, sí se muestra el overlay.
    setTimeout(() => {
      if (failed) return;
      setPrintingState({ active: true, filename: data.filename, promise: printPromise });
    }, 400);
  }

  // Cuando la animación y el backend terminan
  const handlePrintComplete = useCallback((logId: string | null) => {
    setPrintingState({ active: false, filename: "", promise: null });
    if (logId) {
      addToast("Impresión completada correctamente", "success");
      toastRewards(addToast, pendingRewardsRef.current);
      pendingRewardsRef.current = [];
      // replace para que "atrás" vuelva al formulario, no al overlay
      router.replace(`${basePath}/history/${logId}`);
    }
  }, [router, addToast, basePath]);

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
      {parentLink && <BackLink href={parentLink.href} label={parentLink.label} />}

      {/* ── 1. Fila superior: Créditos (50%) + Historial (50%) ── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Créditos */}
        <CreditsBanner
          icon={icons.print}
          value={credits === null ? "—" : formatCredits(credits)}
          label="Créditos de impresión disponibles"
          hint="1 crédito = 1 cara impresa"
        />

        {/* Card clicable de historial */}
        <NavCard
          href={`${basePath}/history`}
          icon={icons.history}
          iconSize="md"
          label="Mis impresiones"
          title={<span className="text-3xl font-bold text-text">{totalPrints}</span>}
          description="Ver historial completo"
        />
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
