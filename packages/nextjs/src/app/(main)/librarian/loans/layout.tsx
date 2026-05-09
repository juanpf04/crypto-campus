import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/** Bloquea /librarian/loans/* si el módulo Biblioteca está pausado. */
export default function LibrarianLoansLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="library">{children}</ModuleGuard>;
}
