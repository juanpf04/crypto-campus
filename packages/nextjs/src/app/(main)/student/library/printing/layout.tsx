import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/** Bloquea /student/library/printing/* si el módulo Impresión está pausado. */
export default function StudentPrintingLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="print">{children}</ModuleGuard>;
}
