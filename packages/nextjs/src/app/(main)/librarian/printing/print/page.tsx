"use client";

import { PrintingHomeView } from "@/components/printing/PrintingHomeView";

export default function LibrarianPrintingPage() {
  return (
    <PrintingHomeView
      basePath="/librarian/printing/print"
      parentLink={{ href: "/librarian/printing", label: "Volver a impresión" }}
    />
  );
}
