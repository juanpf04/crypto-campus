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
 * Reglas:
 *   - Si el usuario es ADMIN → siempre pasa (admin necesita acceso para
 *     despausar y operar incluso con módulos pausados).
 *   - Si el módulo está "active" → renderiza children.
 *   - Si está "paused" o "partial" → renderiza <ModulePausedScreen>.
 *
 * Como es server-side, el HTML que llega al navegador YA es la pantalla de
 * bloqueo. No hay flash. Funciona también con URL tipeada directamente.
 */

import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { getCachedModuleStatus } from "@/lib/system-modules-status";
import type { ModuleId } from "@/lib/system-modules";
import { ModulePausedScreen } from "./ModulePausedScreen";

interface ModuleGuardProps {
  moduleId: ModuleId;
  children: ReactNode;
}

export async function ModuleGuard({ moduleId, children }: ModuleGuardProps) {
  const session = await getSession();

  // Admin siempre tiene acceso (necesita poder despausar / operar).
  if (session.role === "ADMIN") return <>{children}</>;

  const status = await getCachedModuleStatus(moduleId);
  if (status === "active") return <>{children}</>;

  return (
    <ModulePausedScreen
      moduleId={moduleId}
      role={session.role as "STUDENT" | "PROFESSOR" | "LIBRARIAN" | "ADMIN" | undefined}
    />
  );
}
