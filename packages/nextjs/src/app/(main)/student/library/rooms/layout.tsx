import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/** Bloquea /student/library/rooms si el módulo Salas está pausado. */
export default function StudentRoomsLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="rooms">{children}</ModuleGuard>;
}
