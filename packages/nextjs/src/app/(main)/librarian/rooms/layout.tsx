import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/** Bloquea /librarian/rooms/* si el módulo Salas está pausado. */
export default function LibrarianRoomsLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="rooms">{children}</ModuleGuard>;
}
