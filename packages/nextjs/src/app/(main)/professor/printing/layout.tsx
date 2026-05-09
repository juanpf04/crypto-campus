import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/** Bloquea /professor/printing/* si el módulo Impresión está pausado. */
export default function ProfessorPrintingLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="print">{children}</ModuleGuard>;
}
