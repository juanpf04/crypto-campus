"use client";

/**
 * Página de edición de impresora para administradores.
 *
 * Carga los datos actuales de la impresora por ID (parámetro de ruta)
 * y muestra el PrinterForm en modo edición (ID deshabilitado).
 */

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { PrinterForm, type PrinterFormData } from "@/components/forms/PrinterForm";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { BackLink } from "@/components/ui/BackLink";
import { SkeletonPage } from "@/components/ui/Skeleton";

interface PrinterData {
  id: string;
  location: string;
  active: boolean;
}

export default function EditPrinterPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { addToast } = useToast();

  const [printer, setPrinter] = useState<PrinterData | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar datos de la impresora
  useEffect(() => {
    fetch("/api/printer/admin")
      .then((r) => r.json())
      .then((printers: PrinterData[]) => {
        const found = printers.find((p) => p.id === params.id);
        if (found) {
          setPrinter(found);
        } else {
          addToast("Impresora no encontrada", "danger");
          router.push("/admin/printing/printers");
        }
      })
      .catch(() => addToast("Error al cargar impresora", "danger"))
      .finally(() => setLoading(false));
  }, [params.id, addToast, router]);

  async function handleSubmit(data: PrinterFormData) {
    const res = await fetch(`/api/printer/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: data.location,
      }),
    });

    const body = await res.json();

    if (!res.ok) {
      addToast(body.error ?? "Error al actualizar la impresora", "danger");
      throw new Error(body.error);
    }

    addToast(`Impresora "${params.id}" actualizada correctamente`, "success");
    router.push("/admin/printing/printers");
  }

  if (loading) return <SkeletonPage />;

  if (!printer) return null;

  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-lg space-y-4">
        <BackLink href="/admin/printing/printers" label="Volver a impresoras" />

        <Card>
          <CardHeader>
            <CardTitle>Editar impresora</CardTitle>
            <p className="text-sm text-text-muted">
              Modifica los datos de la impresora {printer.id}.
            </p>
          </CardHeader>
          <CardBody>
            <PrinterForm
              isEdit
              onSubmit={handleSubmit}
              initialValues={{
                id: printer.id,
                location: printer.location,
              }}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
