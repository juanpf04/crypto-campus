"use client";

/**
 * Zona de arrastrar y soltar archivos, con selector de carpetas como fallback.
 *
 * Basado en react-dropzone. Acepta una lista configurable de tipos MIME
 * y muestra feedback visual al arrastrar (borde activo en color primary).
 * Reutilizable para cualquier futuro upload (biblioteca, tareas...).
 */

import { useDropzone, type Accept } from "react-dropzone";
import { cn } from "@/lib/utils";

interface FileDropZoneProps {
  /** Callback al seleccionar un archivo válido */
  onFile: (file: File) => void;
  /** Tipos MIME aceptados (default: documentos imprimibles) */
  accept?: Accept;
  /** Tamaño máximo en bytes (default: 50 MB) */
  maxSize?: number;
  /** Mensaje principal dentro de la zona */
  label?: string;
  /** Mensaje secundario (formatos aceptados, etc.) */
  hint?: string;
  /** Clase CSS adicional */
  className?: string;
  /** Callback de error (archivo demasiado grande, tipo no válido...) */
  onError?: (message: string) => void;
}

/** Formatos que se pueden imprimir normalmente */
const DEFAULT_ACCEPT: Accept = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "text/plain": [".txt"],
};

const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export function FileDropZone({
  onFile,
  accept = DEFAULT_ACCEPT,
  maxSize = DEFAULT_MAX_SIZE,
  label = "Arrastra un archivo aquí o haz clic para seleccionar",
  hint = "PDF, Word, Excel, PowerPoint, imágenes o texto (máx. 50 MB)",
  className,
  onError,
}: FileDropZoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxSize,
    multiple: false,
    onDropAccepted: (files) => {
      if (files[0]) onFile(files[0]);
    },
    onDropRejected: (rejections) => {
      const rejection = rejections[0];
      if (!rejection) return;

      const error = rejection.errors[0];
      if (error?.code === "file-too-large") {
        onError?.(`El archivo supera el tamaño máximo (${Math.round(maxSize / 1024 / 1024)} MB)`);
      } else if (error?.code === "file-invalid-type") {
        onError?.("Formato de archivo no admitido");
      } else {
        onError?.(error?.message ?? "Archivo no válido");
      }
    },
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors",
        isDragActive
          ? "border-primary bg-primary/5 text-primary"
          : "border-border-default text-text-muted hover:border-primary/50 hover:text-text",
        className,
      )}
    >
      <input {...getInputProps()} />

      {/* Icono de subida */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-8 w-8"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>

      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-text-muted mt-1">{hint}</p>
      </div>
    </div>
  );
}
