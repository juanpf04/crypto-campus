/**
 * ModuleGuard — Server Component que bloquea una sección si el módulo asociado
 * está pausado on-chain.
 *
 * Uso típico: en un layout.tsx server component.
 *
 *   export default function PrintingLayout({ children }: { children: ReactNode }) {
 *     return <ModuleGuard moduleId="print">{children}</ModuleGuard>;
 *   }
 *
 * Reglas (pausa unificada — ningún rol bypassa):
 *   - Si el módulo está "active" → renderiza children.
 *   - Si está "paused" o "partial" → renderiza <ModulePausedScreen>.
 *
 * El admin tampoco puede operar el módulo mientras está pausado: debe ir a
 * /admin/system para despausarlo primero. Esa ruta NO lleva ModuleGuard
 * justamente para que siempre sea accesible y pueda despausar.
 *
 * Como es server-side, el HTML que llega al navegador YA es la pantalla de
 * bloqueo. No hay flash. Funciona también con URL tipeada directamente.
 */

import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { getModuleStatus } from "@/lib/system-modules-status";
import type { ModuleId } from "@/lib/system-modules";
import { ModulePausedScreen } from "./ModulePausedScreen";

interface ModuleGuardProps {
  moduleId: ModuleId;
  children: ReactNode;
}

export async function ModuleGuard({ moduleId, children }: ModuleGuardProps) {
  const session = await getSession();

  const status = await getModuleStatus(moduleId);
  if (status === "active") return <>{children}</>;

  return (
    <ModulePausedScreen
      moduleId={moduleId}
      role={session.role as "STUDENT" | "PROFESSOR" | "LIBRARIAN" | "ADMIN" | undefined}
      status={status}
    />
  );
}
