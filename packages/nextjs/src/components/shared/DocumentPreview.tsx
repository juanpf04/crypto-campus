"use client";

/**
 * Preview de un documento almacenado en el servidor.
 *
 * - PDF: lo muestra embebido con <embed>.
 * - Imágenes (jpg, png): lo muestra con <img> object-contain.
 * - Otros formatos: icono de documento con extensión.
 * - Si el archivo ya expiró (>24h) o no existe: fallback con mensaje.
 *
 * Reutilizable en cualquier vista de detalle con documentos subidos.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";

interface DocumentPreviewProps {
  /** URL del endpoint que sirve el archivo (e.g. /api/printer/files/abc.pdf) */
  src: string | null;
  /** Nombre original del archivo */
  filename: string;
  /** Fecha de impresión (ISO string) — para calcular expiración */
  printedAt: string;
  /** Horas de retención del archivo (default: 24) */
  retentionHours?: number;
  /** Clase CSS adicional */
  className?: string;
}

/** Detecta el tipo de archivo por extensión */
function getFileType(filename: string): "pdf" | "image" | "other" {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) return "image";
  return "other";
}

/** Formatea una fecha a string legible en español */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocumentPreview({
  src,
  filename,
  printedAt,
  retentionHours = 24,
  className,
}: DocumentPreviewProps) {
  const [loadError, setLoadError] = useState(false);

  // Calcular expiración
  const printDate = new Date(printedAt);
  const expiresAt = new Date(printDate.getTime() + retentionHours * 60 * 60 * 1000);
  const isExpired = new Date() > expiresAt;
  const fileType = getFileType(filename);

  // Si no hay src, está expirado, o hubo error de carga → fallback
  if (!src || isExpired || loadError) {
    return (
      <div className={cn("flex flex-col items-center justify-center rounded-lg border border-border-default bg-card p-8 text-center", className)}>
        {/* Icono de documento no disponible */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-16 w-16 text-text-muted/50 mb-4"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="4" y1="4" x2="20" y2="20" />
        </svg>

        <p className="text-sm font-medium text-text-muted mb-1">Documento no disponible</p>
        {isExpired ? (
          <p className="text-xs text-text-muted">
            El documento expiró el {formatDateTime(expiresAt.toISOString())}.
            Los archivos se conservan {retentionHours} horas tras la impresión.
          </p>
        ) : (
          <p className="text-xs text-text-muted">
            No se pudo cargar el archivo.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border-default bg-card", className)}>
      {/* Contenedor de la preview */}
      <div className="flex items-center justify-center bg-black/5 min-h-[400px]">
        {fileType === "pdf" && (
          <embed
            src={src}
            type="application/pdf"
            className="h-[500px] w-full"
            onError={() => setLoadError(true)}
          />
        )}

        {fileType === "image" && (
          <img
            src={src}
            alt={filename}
            className="max-h-[500px] w-auto object-contain p-4"
            onError={() => setLoadError(true)}
          />
        )}

        {fileType === "other" && (
          <div className="flex flex-col items-center gap-3 text-text-muted p-8">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-16 w-16"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <p className="text-sm font-medium text-text">
              {filename.split(".").pop()?.toUpperCase()} — Vista previa no disponible
            </p>
            <p className="text-xs text-text-muted">
              Descarga el archivo para visualizarlo.
            </p>
          </div>
        )}
      </div>

      {/* Barra inferior con info de disponibilidad */}
      <div className="flex items-center justify-between border-t border-border-default px-4 py-2.5 bg-card">
        <p className="text-xs text-text-muted truncate max-w-[60%]">{filename}</p>
        <p className="text-xs text-text-muted shrink-0">
          Disponible hasta el {formatDateTime(expiresAt.toISOString())}
        </p>
      </div>
    </div>
  );
}
