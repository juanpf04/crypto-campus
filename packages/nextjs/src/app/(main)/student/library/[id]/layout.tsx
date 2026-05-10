import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/**
 * El detalle de un libro/ítem (`/student/library/[id]`) sí depende 100% del
 * módulo Biblioteca: si está pausado no hay nada útil que mostrar. La página
 * hub `/student/library` no lleva guard global para que rooms/printing y
 * la sección library coexistan con sus estados independientes.
 */
export default function StudentLibraryItemLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="library">{children}</ModuleGuard>;
}
