import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/** Bloquea /librarian/printing/* si el módulo Impresión está pausado. */
export default function LibrarianPrintingLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="print">{children}</ModuleGuard>;
}
