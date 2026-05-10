import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/** Bloquea /admin/pending-reviews/* si el módulo Insignias está pausado. */
export default function AdminPendingReviewsLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="badges">{children}</ModuleGuard>;
}
