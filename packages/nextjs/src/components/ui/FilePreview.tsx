"use client";

/**
 * Preview de un archivo seleccionado para imprimir.
 *
 * - PDF: muestra la primera página en un iframe.
 * - Imágenes: muestra un thumbnail con object-fit contain.
 * - Otros (DOCX, XLSX, etc.): muestra icono de documento con nombre y tamaño.
 *
 * Incluye un botón para cambiar de archivo (input nativo, sin react-dropzone
 * para evitar interferencias con iframes y descargas no deseadas).
 * Reutilizable para cualquier módulo con subida de archivos.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { icons } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";

interface FilePreviewProps {
  /** Archivo a previsualizar */
  file: File;
  /** Número de páginas detectadas (se muestra como badge) */
  pageCount?: number;
  /** Callback para cambiar el archivo */
  onChangeFile?: (file: File) => void;
  /** String de accept para el input nativo (ej: ".pdf,.docx,.jpg") */
  acceptString?: string;
  /** Clase CSS adicional para el contenedor */
  className?: string;
}

/** Formatea bytes a una cadena legible (KB, MB...) */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Extensiones que soportamos para preview visual */
function getFileCategory(type: string): "pdf" | "image" | "other" {
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  return "other";
}

export function FilePreview({ file, pageCount, onChangeFile, acceptString, className }: FilePreviewProps) {
  const [expandedForFile, setExpandedForFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const category = getFileCategory(file.type);
  const fileIdentity = `${file.name}-${file.size}-${file.lastModified}`;
  const isExpanded = expandedForFile === fileIdentity;

  const previewUrl = useMemo(() => {
    if (category === "other") return null;
    return URL.createObjectURL(file);
  }, [file, category]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Handler para el input nativo de cambio de archivo
  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected && onChangeFile) {
      onChangeFile(selected);
    }
    // Reset del input para permitir re-seleccionar el mismo archivo
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border-default bg-card",
        className,
      )}
    >
      {/* Input nativo oculto para cambiar archivo */}
      {onChangeFile && (
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptString}
          className="hidden"
          onChange={handleFileInputChange}
        />
      )}

      {/* Preview visual — más grande para que se vea bien */}
      <div className="flex items-center justify-center bg-black/5 h-64">
        {category === "pdf" && previewUrl && (
          <iframe
            src={`${previewUrl}#toolbar=0&navpanes=0`}
            className="h-full w-full"
            title="Vista previa del PDF"
          />
        )}

        {category === "image" && previewUrl && (
          <Image
            src={previewUrl}
            alt={file.name}
            width={1200}
            height={800}
            unoptimized
            className="h-full w-full object-contain p-2"
          />
        )}

        {category === "other" && (
          <div className="flex flex-col items-center gap-3 text-text-muted">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-12 w-12"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <p className="text-sm font-medium text-text">{file.name.split(".").pop()?.toUpperCase()}</p>
          </div>
        )}
      </div>

      {/* Barra inferior con info del archivo + botón de cambiar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border-default">
        <div className="flex items-center gap-3 min-w-0">
          <p className="truncate font-medium text-sm text-text max-w-[50%]">{file.name}</p>
          <span className="text-xs text-text-muted shrink-0">{formatBytes(file.size)}</span>
          {pageCount !== undefined && pageCount > 0 && (
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0">
              {pageCount} {pageCount === 1 ? "pág." : "págs."}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {onChangeFile && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer"
            >
              Cambiar archivo
            </button>
          )}

          {(category === "pdf" || category === "image") && (
            <button
              type="button"
              onClick={() => setExpandedForFile(fileIdentity)}
              className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer"
              aria-label="Ampliar vista previa"
              title="Ampliar vista previa"
            >
              {icons.expand}
            </button>
          )}
        </div>
      </div>

      <Modal
        open={isExpanded}
        onClose={() => setExpandedForFile(null)}
        title={`Vista previa: ${file.name}`}
        className="max-w-6xl"
      >
        <div className="h-[75vh]">
          {category === "pdf" && previewUrl && (
            <iframe
              src={previewUrl}
              className="h-full w-full rounded-lg border border-border-default bg-white"
              title="Vista previa del PDF"
            />
          )}

          {category === "image" && previewUrl && (
            <Image
              src={previewUrl}
              alt={file.name}
              width={1600}
              height={1200}
              unoptimized
              className="h-full w-full rounded-lg border border-border-default bg-black/5 object-contain"
            />
          )}

          {category === "other" && (
            <div className="flex h-full items-center justify-center rounded-lg border border-border-default bg-black/5 text-sm text-text-muted">
              Vista previa no disponible para este formato.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
