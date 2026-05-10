import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/**
 * Bloquea las rutas del módulo Biblioteca dentro de /admin/library:
 * /admin/library/items, /admin/library/loans, /admin/library/tokens.
 *
 * Está dentro del route group `(library-only)` para NO afectar a la subruta
 * `rooms/` (módulo Salas) ni al `page.tsx` hub que mezcla varios módulos.
 */
export default function AdminLibraryOnlyLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="library">{children}</ModuleGuard>;
}
