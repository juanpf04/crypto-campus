import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/** Bloquea /admin/printing/* si el módulo Impresión está pausado. */
export default function AdminPrintingLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="print">{children}</ModuleGuard>;
}
