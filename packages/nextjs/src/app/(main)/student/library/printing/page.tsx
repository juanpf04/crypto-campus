"use client";

import { PrintingHomeView } from "@/components/printing/PrintingHomeView";

export default function StudentPrintingPage() {
  return (
    <PrintingHomeView
      basePath="/student/library/printing"
      parentLink={{ href: "/student/library", label: "Volver a biblioteca" }}
    />
  );
}
