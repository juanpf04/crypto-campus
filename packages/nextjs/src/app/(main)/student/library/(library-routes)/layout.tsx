import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/**
 * Bloquea las rutas /student/library y /student/library/[id] si el módulo
 * Biblioteca (LibraryManager + LibraryToken) está pausado.
 *
 * Está dentro de un route group `(library-routes)` para NO afectar a las
 * subrutas `printing/` y `rooms/`, que pertenecen a sus propios módulos
 * (print y rooms) y tienen sus propios layouts hermanos.
 */
export default function StudentLibraryRoutesLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="library">{children}</ModuleGuard>;
}
