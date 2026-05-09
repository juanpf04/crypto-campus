import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/** Bloquea /librarian/items/* si el módulo Biblioteca está pausado. */
export default function LibrarianItemsLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="library">{children}</ModuleGuard>;
}
