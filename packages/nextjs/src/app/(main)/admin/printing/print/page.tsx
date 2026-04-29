"use client";

import { PrintingHomeView } from "@/components/printing/PrintingHomeView";

export default function AdminPrintingPage() {
  return (
    <PrintingHomeView
      basePath="/admin/printing/print"
      parentLink={{ href: "/admin/printing", label: "Volver a impresión" }}
    />
  );
}
