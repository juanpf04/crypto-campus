"use client";

/**
 * Preview de un archivo seleccionado para imprimir.
 *
 * - PDF: muestra la primera página en un iframe.
 * - Imágenes: muestra un thumbnail con object-fit contain.
 * - Otros (DOCX, XLSX, etc.): muestra icono de documento con nombre y tamaño.
 *
 * Incluye un botón para cambiar de archivo (re-abre el file picker).
 * Reutilizable para cualquier módulo con subida de archivos.
 */

import { useEffect, useState } from "react";
import { useDropzone, type Accept } from "react-dropzone";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";

interface FilePreviewProps {
  /** Archivo a previsualizar */
  file: File;
  /** Número de páginas detectadas (se muestra como badge) */
  pageCount?: number;
  /** Callback para cambiar el archivo */
  onChangeFile?: (file: File) => void;
  /** Tipos MIME aceptados para el cambio (igual que el dropzone padre) */
  accept?: Accept;
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

export function FilePreview({ file, pageCount, onChangeFile, accept, className }: FilePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const category = getFileCategory(file.type);

  // Dropzone solo para el botón de cambiar archivo
  const { getRootProps, getInputProps, open } = useDropzone({
    accept,
    multiple: false,
    noClick: true,
    noDrag: true,
    onDropAccepted: (files) => {
      if (files[0] && onChangeFile) onChangeFile(files[0]);
    },
  });

  // Generar URL temporal para preview
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    setIsExpanded(false);
  }, [file]);

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative overflow-hidden rounded-lg border border-border-default bg-card",
        className,
      )}
    >
      <input {...getInputProps()} />

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
          <img
            src={previewUrl}
            alt={file.name}
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
              onClick={open}
              className="text-xs font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer"
            >
              Cambiar archivo
            </button>
          )}

          {(category === "pdf" || category === "image") && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer"
              aria-label="Ampliar vista previa"
              title="Ampliar vista previa"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4.5 w-4.5"
                aria-hidden="true"
              >
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <Modal
        open={isExpanded}
        onClose={() => setIsExpanded(false)}
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
            <img
              src={previewUrl}
              alt={file.name}
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
