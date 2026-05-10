import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/** Bloquea /admin/students/* si el módulo Insignias está pausado. */
export default function AdminStudentsLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="badges">{children}</ModuleGuard>;
}
