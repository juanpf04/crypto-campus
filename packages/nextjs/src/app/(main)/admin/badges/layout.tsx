import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/** Bloquea /admin/badges/* si el módulo Insignias está pausado. */
export default function AdminBadgesLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="badges">{children}</ModuleGuard>;
}
