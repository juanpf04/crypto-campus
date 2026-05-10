import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/** Bloquea /admin/shop/* si el módulo Tienda está pausado. */
export default function AdminShopLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="shop">{children}</ModuleGuard>;
}
