"use client";

/**
 * Simulador de impresión completo.
 *
 * Flujo:
 * 1. El usuario arrastra/selecciona un archivo (PDF, Word, Excel, PPT, imágenes, texto).
 * 2. El dropzone desaparece y se muestra la preview del archivo en su lugar.
 * 3. Se detecta automáticamente el número de páginas (pdf-lib para PDF, 1 para el resto).
 * 4. Se muestran las opciones de impresión: impresora, copias, color, orientación,
 *    cara, tamaño de papel, rango de páginas, páginas por hoja.
 * 5. Un panel de resumen calcula el coste en tiempo real:
 *    hojas = ceil(páginas / págs_por_hoja), créditos = hojas × copias.
 * 6. Al enviar, se sube el archivo al servidor y se ejecuta la transacción blockchain.
 */

import { useState, useCallback, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import { useToast } from "@/hooks/useToast";
import { Button, Select } from "@/components/ui";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { FilePreview } from "@/components/ui/FilePreview";
import { PrintCostSummary } from "@/components/shared/PrintCostSummary";

// ── Tipos ──

export interface PrintJobResult {
  printerId: string;
  filename: string;
  pages: number;
  copies: number;
  color: boolean;
  duplex: boolean;
  orientation: "portrait" | "landscape";
  paperSize: "A4" | "A5" | "A3";
  pageRangeFrom: number | null;
  pageRangeTo: number | null;
  pagesPerSheet: number;
  filePages: number;
  fileSize: number;
  filePath: string | null;
}

interface Printer {
  id: string;
  name: string;
  location: string;
}

interface PrintJobFormProps {
  /** Lista de impresoras activas */
  printers: Printer[];
  /** Créditos disponibles del usuario */
  availableCredits: number;
  /** Callback al enviar el formulario */
  onSubmit: (data: PrintJobResult) => Promise<void> | void;
  /** Texto del botón (default "Imprimir") */
  submitLabel?: string;
}

// ── Opciones de los selects ──

const COLOR_OPTIONS = [
  { value: "bw", label: "Blanco y negro" },
  { value: "color", label: "Color" },
];

const ORIENTATION_OPTIONS = [
  { value: "portrait", label: "Vertical (retrato)" },
  { value: "landscape", label: "Apaisado (paisaje)" },
];

const DUPLEX_OPTIONS = [
  { value: "single", label: "Una cara" },
  { value: "duplex", label: "Doble cara" },
];

const PAPER_OPTIONS = [
  { value: "A4", label: "A4" },
  { value: "A5", label: "A5" },
  { value: "A3", label: "A3" },
];

const PAGES_PER_SHEET_OPTIONS = [
  { value: "1", label: "1 página por hoja" },
  { value: "2", label: "2 páginas por hoja" },
  { value: "4", label: "4 páginas por hoja" },
];

const PAGE_RANGE_OPTIONS = [
  { value: "all", label: "Todas las páginas" },
  { value: "custom", label: "Personalizado" },
];

// ── Componente ──

export function PrintJobForm({
  printers,
  availableCredits,
  onSubmit,
  submitLabel = "Imprimir",
}: PrintJobFormProps) {
  const { addToast } = useToast();

  // Archivo
  const [file, setFile] = useState<File | null>(null);
  const [filePages, setFilePages] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Opciones de impresión
  const [printerId, setPrinterId] = useState("");
  const [copies, setCopies] = useState(1);
  const [color, setColor] = useState("bw");
  const [orientation, setOrientation] = useState("portrait");
  const [duplex, setDuplex] = useState("single");
  const [paperSize, setPaperSize] = useState("A4");
  const [pagesPerSheet, setPagesPerSheet] = useState("1");
  const [pageRange, setPageRange] = useState("all");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  // Configuración avanzada
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Envío
  const [submitting, setSubmitting] = useState(false);
  const hasPrinters = printers.length > 0;

  // Seleccionar automáticamente la primera impresora disponible
  useEffect(() => {
    if (!hasPrinters) {
      setPrinterId("");
      return;
    }
    if (!printerId) {
      setPrinterId(printers[0].id);
    }
  }, [hasPrinters, printerId, printers]);

  // Opciones del dropdown de impresoras
  const printerOptions = printers.map((p) => ({
    value: p.id,
    label: `${p.name} — ${p.location}`,
  }));

  // ── Detección de páginas al seleccionar archivo ──
  const handleFile = useCallback(async (f: File) => {
    setFile(f);

    if (f.type === "application/pdf") {
      try {
        const buffer = await f.arrayBuffer();
        const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
        setFilePages(pdf.getPageCount());
      } catch {
        addToast("No se pudo leer el PDF. Se asumirá 1 página.", "warning");
        setFilePages(1);
      }
    } else {
      // Imágenes, DOCX, etc. = 1 página (no podemos contar páginas de DOCX en el cliente)
      setFilePages(1);
    }

    // Reset rango al cambiar de archivo
    setPageRange("all");
    setRangeFrom("");
    setRangeTo("");
  }, [addToast]);

  // ── Validación y clampeo del rango de páginas ──
  function handleRangeFrom(value: string) {
    const num = parseInt(value);
    if (value === "") {
      setRangeFrom("");
      return;
    }
    // Mínimo 1, máximo filePages
    const clamped = Math.max(1, Math.min(num || 1, filePages));
    setRangeFrom(String(clamped));
    // Si "desde" supera "hasta", ajustar "hasta"
    const currentTo = parseInt(rangeTo) || filePages;
    if (clamped > currentTo) {
      setRangeTo(String(clamped));
    }
  }

  function handleRangeTo(value: string) {
    const num = parseInt(value);
    if (value === "") {
      setRangeTo("");
      return;
    }
    const currentFrom = parseInt(rangeFrom) || 1;
    // Mínimo = rangeFrom, máximo = filePages
    const clamped = Math.max(currentFrom, Math.min(num || currentFrom, filePages));
    setRangeTo(String(clamped));
  }

  // ── Cálculo de páginas efectivas ──
  const effectivePages = (() => {
    if (filePages === 0) return 0;

    let pages = filePages;

    // Rango personalizado
    if (pageRange === "custom") {
      const from = parseInt(rangeFrom) || 1;
      const to = parseInt(rangeTo) || filePages;
      const clampedFrom = Math.max(1, Math.min(from, filePages));
      const clampedTo = Math.max(clampedFrom, Math.min(to, filePages));
      pages = clampedTo - clampedFrom + 1;
    }

    return pages;
  })();

  // Créditos reales con pagesPerSheet
  const pps = parseInt(pagesPerSheet) || 1;
  const sheetsNeeded = Math.ceil(effectivePages / pps);
  const totalCredits = sheetsNeeded * copies;

  // ── Subida del archivo al servidor ──
  async function uploadFile(): Promise<{ filePath: string } | null> {
    if (!file) return null;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/printer/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error ?? "Error al subir el archivo");
    }

    return res.json();
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validaciones
    if (!file) {
      addToast("Selecciona un archivo para imprimir", "danger");
      return;
    }
    if (!printerId) {
      addToast("Selecciona una impresora", "danger");
      return;
    }
    if (effectivePages <= 0) {
      addToast("El rango de páginas no es válido", "danger");
      return;
    }
    if (copies < 1) {
      addToast("El número de copias debe ser al menos 1", "danger");
      return;
    }
    if (totalCredits > availableCredits) {
      addToast("No tienes suficientes créditos de impresión", "danger");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Subir archivo
      setUploading(true);
      const uploaded = await uploadFile();
      setUploading(false);

      // 2. Ejecutar impresión — pages = sheetsNeeded (las hojas reales que se imprimen)
      const fromVal = pageRange === "custom" ? parseInt(rangeFrom) || 1 : null;
      const toVal = pageRange === "custom" ? parseInt(rangeTo) || filePages : null;

      await onSubmit({
        printerId,
        filename: file.name,
        pages: sheetsNeeded,
        copies,
        color: color === "color",
        duplex: duplex === "duplex",
        orientation: orientation as "portrait" | "landscape",
        paperSize: paperSize as "A4" | "A5" | "A3",
        pageRangeFrom: fromVal,
        pageRangeTo: toVal,
        pagesPerSheet: pps,
        filePages,
        fileSize: file.size,
        filePath: uploaded?.filePath ?? null,
      });
    } catch (err) {
      // El toast de error lo gestiona la page
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── 1. Zona de archivo / Preview ── */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text">Archivo a imprimir</label>

        {/* Si no hay archivo: mostrar dropzone. Si hay archivo: mostrar preview */}
        {!file ? (
          <FileDropZone
            onFile={handleFile}
            onError={(msg) => addToast(msg, "danger")}
          />
        ) : (
          <FilePreview
            file={file}
            pageCount={filePages}
            onChangeFile={handleFile}
            acceptString=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          />
        )}
      </div>

      {/* ── 2. Impresora ── */}
      <Select
        label="Impresora"
        placeholder={hasPrinters ? "Selecciona una impresora" : "No hay impresoras activas"}
        options={printerOptions}
        value={printerId}
        disabled={!hasPrinters}
        onChange={(e) => setPrinterId(e.currentTarget.value)}
      />
      {!hasPrinters && (
        <p className="-mt-3 text-sm text-text-muted">
          No hay impresoras activas disponibles. Contacta con un administrador para registrar una.
        </p>
      )}

      {/* ── 3. Configuración básica ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Copias</label>
          <input
            type="number"
            min={1}
            value={copies}
            onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
            className="rounded-lg border border-border-default bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
        <Select
          label="Color"
          options={COLOR_OPTIONS}
          value={color}
          onChange={(e) => setColor(e.currentTarget.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Orientación"
          options={ORIENTATION_OPTIONS}
          value={orientation}
          onChange={(e) => setOrientation(e.currentTarget.value)}
        />
        <Select
          label="Cara"
          options={DUPLEX_OPTIONS}
          value={duplex}
          onChange={(e) => setDuplex(e.currentTarget.value)}
        />
      </div>

      {/* ── 4. Configuración avanzada (colapsable) ── */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
          Configuración avanzada
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 pl-1 border-l-2 border-border-default ml-1.5">
            <div className="pl-4 space-y-4">
              {/* Rango de páginas */}
              <Select
                label="Rango de páginas"
                options={PAGE_RANGE_OPTIONS}
                value={pageRange}
                onChange={(e) => setPageRange(e.currentTarget.value)}
              />

              {pageRange === "custom" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text">
                      Desde página <span className="text-text-muted font-normal">(1–{filePages})</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={filePages}
                      value={rangeFrom}
                      onChange={(e) => handleRangeFrom(e.target.value)}
                      className="rounded-lg border border-border-default bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text">
                      Hasta página <span className="text-text-muted font-normal">(1–{filePages})</span>
                    </label>
                    <input
                      type="number"
                      min={parseInt(rangeFrom) || 1}
                      max={filePages}
                      value={rangeTo}
                      onChange={(e) => handleRangeTo(e.target.value)}
                      className="rounded-lg border border-border-default bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {/* Tamaño de papel */}
              <Select
                label="Tamaño de papel"
                options={PAPER_OPTIONS}
                value={paperSize}
                onChange={(e) => setPaperSize(e.currentTarget.value)}
              />

              {/* Páginas por hoja */}
              <Select
                label="Páginas por hoja"
                options={PAGES_PER_SHEET_OPTIONS}
                value={pagesPerSheet}
                onChange={(e) => setPagesPerSheet(e.currentTarget.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Resumen de coste ── */}
      {file && effectivePages > 0 && (
        <PrintCostSummary
          pages={effectivePages}
          copies={copies}
          pagesPerSheet={pps}
          availableCredits={availableCredits}
        />
      )}

      {/* ── 6. Botón de envío ── */}
      <Button
        type="submit"
        loading={submitting}
        disabled={!file || !hasPrinters || !printerId || effectivePages <= 0 || submitting}
        className="w-full"
        size="lg"
      >
        {uploading ? "Subiendo archivo..." : submitLabel}
      </Button>
    </form>
  );
}
