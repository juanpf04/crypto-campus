import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/**
 * Bloquea todas las rutas bajo /student/badges/* si el módulo Insignias
 * (BadgeSystem) está pausado por el administrador. Server-side, sin flash.
 */
export default function StudentBadgesLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="badges">{children}</ModuleGuard>;
}
