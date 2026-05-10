import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/** Bloquea /admin/rewards/* si el módulo Insignias está pausado. */
export default function AdminRewardsLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="badges">{children}</ModuleGuard>;
}
