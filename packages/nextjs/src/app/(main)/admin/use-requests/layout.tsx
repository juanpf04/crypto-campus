import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/** Bloquea /admin/use-requests/* si el módulo Insignias está pausado. */
export default function AdminUseRequestsLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="badges">{children}</ModuleGuard>;
}
