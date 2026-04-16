"use client";

/**
 * Página de creación de impresora para administradores.
 *
 * Mismo patrón que /admin/users/new: BackLink + Card centrada + Form.
 */

import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { PrinterForm, type PrinterFormData } from "@/components/forms/PrinterForm";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { BackLink } from "@/components/ui/BackLink";

export default function NewPrinterPage() {
  const router = useRouter();
  const { addToast } = useToast();

  async function handleSubmit(data: PrinterFormData) {
    const res = await fetch("/api/printer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: data.id,
        location: data.location,
      }),
    });

    const body = await res.json();

    if (!res.ok) {
      addToast(body.error ?? "Error al registrar la impresora", "danger");
      throw new Error(body.error);
    }

    addToast(`Impresora "${data.id}" registrada correctamente`, "success");
    router.push("/admin/printing/printers");
  }

  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-lg space-y-4">
        <BackLink href="/admin/printing/printers" label="Volver a impresoras" />

        <Card>
          <CardHeader>
            <CardTitle>Registrar impresora</CardTitle>
            <p className="text-sm text-text-muted">
              Introduce los datos de la nueva impresora física.
            </p>
          </CardHeader>
          <CardBody>
            <PrinterForm onSubmit={handleSubmit} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
