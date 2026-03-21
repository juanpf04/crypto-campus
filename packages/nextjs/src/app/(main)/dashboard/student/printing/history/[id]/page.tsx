"use client";

/**
 * Detalle de un trabajo de impresión del estudiante.
 *
 * Layout a 2 columnas:
 * - Izquierda (60%): Preview del documento (si aún está disponible, 24h máx.)
 * - Derecha (40%): Ficha técnica con todos los datos de la impresión
 *
 * En móvil se apilan verticalmente (preview arriba, ficha debajo).
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { DocumentPreview } from "@/components/shared/DocumentPreview";
import { DetailField } from "@/components/shared/DetailField";

interface PrintLogDetail {
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
  pageRangeFrom: number | null;
  pageRangeTo: number | null;
  pagesPerSheet: number;
  filePages: number;
  fileSize: number;
  filePath: string | null;
  txHash: string;
  createdAt: string;
  printer: { id: string; name: string; location: string; floor: string | null };
}

/** Formatea bytes a cadena legible */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Formatea fecha+hora */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Extrae solo el nombre del archivo del filePath (UUID.ext) */
function extractFilename(filePath: string | null): string | null {
  if (!filePath) return null;
  const parts = filePath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? null;
}

export default function StudentPrintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();

  const [log, setLog] = useState<PrintLogDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/printer/logs/${id}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) {
          let message = "No se pudo cargar el detalle de la impresión";
          try {
            const body = await r.json();
            if (body?.error) message = body.error;
          } catch {
            // Ignorar errores de parseo y usar mensaje por defecto
          }
          throw new Error(message);
        }
        return r.json();
      })
      .then((data) => {
        setLog(data);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        const message = error instanceof Error ? error.message : "No se pudo cargar el detalle de la impresión";
        addToast(message, "danger");
      })
      .finally(() => setLoading(false));

    return () => {
      controller.abort();
    };
  }, [id, addToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!log) {
    return (
      <div className="space-y-6">
        <BackLink href="/dashboard/student/printing/history" label="Volver al historial" />
        <p className="text-text-muted">Impresión no encontrada.</p>
      </div>
    );
  }

  // URL para servir el archivo (si existe)
  const savedFilename = extractFilename(log.filePath);
  const fileSrc = savedFilename ? `/api/printer/files/${savedFilename}` : null;

  // Rango de páginas legible
  const pageRangeText =
    log.pageRangeFrom && log.pageRangeTo
      ? `${log.pageRangeFrom} – ${log.pageRangeTo}`
      : "Todas";

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/student/printing/history" label="Volver al historial" />

      <div>
        <h1 className="text-2xl font-bold text-text">Detalle de impresión</h1>
        <p className="text-text-muted mt-1">
          Impreso el {formatDateTime(log.createdAt)}
        </p>
      </div>

      {/* Layout 2 columnas en desktop */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Columna izquierda: Preview del documento (60%) */}
        <div className="lg:col-span-3">
          <DocumentPreview
            src={fileSrc}
            filename={log.filename}
            printedAt={log.createdAt}
          />
        </div>

        {/* Columna derecha: Ficha técnica (40%) */}
        <Card className="lg:col-span-2 space-y-5">
          <h3 className="text-sm font-semibold text-text border-b border-border-default pb-3">
            Ficha técnica
          </h3>

          {/* Archivo */}
          <div className="space-y-3">
            <DetailField label="Archivo" value={log.filename} />
            <DetailField label="Tamaño" value={formatBytes(log.fileSize)} />
            <DetailField
              label="Páginas del documento"
              value={`${log.filePages} ${log.filePages === 1 ? "página" : "páginas"}`}
            />
          </div>

          <div className="border-t border-border-default" />

          {/* Impresora */}
          <div className="space-y-3">
            <DetailField label="Impresora" value={log.printer.name} />
            <DetailField label="Ubicación" value={log.printer.location} />
            {log.printer.floor && (
              <DetailField label="Planta" value={log.printer.floor} />
            )}
          </div>

          <div className="border-t border-border-default" />

          {/* Configuración */}
          <div className="space-y-3">
            <DetailField
              label="Color"
              value={
                <Badge variant={log.color ? "info" : "neutral"}>
                  {log.color ? "Color" : "Blanco y negro"}
                </Badge>
              }
            />
            <DetailField
              label="Orientación"
              value={log.orientation === "portrait" ? "Vertical (retrato)" : "Apaisado (paisaje)"}
            />
            <DetailField
              label="Cara"
              value={log.duplex ? "Doble cara" : "Una cara"}
            />
            <DetailField label="Tamaño de papel" value={log.paperSize} />
            <DetailField label="Rango de páginas" value={pageRangeText} />
            {log.pagesPerSheet > 1 && (
              <DetailField
                label="Páginas por hoja"
                value={`${log.pagesPerSheet} páginas por hoja`}
              />
            )}
            <DetailField label="Copias" value={log.copies} />
          </div>

          <div className="border-t border-border-default" />

          {/* Resultado */}
          <div className="space-y-3">
            <DetailField label="Hojas impresas" value={log.pages} />
            <DetailField
              label="Créditos consumidos"
              value={
                <Badge variant="warning">{log.creditsUsed}</Badge>
              }
            />
            <DetailField label="Créditos restantes" value={log.creditsAfter} />
            <DetailField
              label="Tx Hash (blockchain)"
              value={
                <span className="font-mono text-xs break-all">{log.txHash}</span>
              }
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
