/**
 * ModuleSectionGuard — Versión "compacta" de ModuleGuard.
 *
 * Para usar dentro de páginas hub que mezclan contenido de varios módulos:
 * envuelve solo la sección de UN módulo y, si éste está pausado, renderiza
 * una Card pequeña en lugar de bloquear toda la página. Así el usuario sigue
 * viendo y usando el resto de secciones de otros módulos activos.
 *
 *   <ModuleSectionGuard moduleId="library">
 *     <CatalogoLibros />
 *   </ModuleSectionGuard>
 *
 * Server Component — el HTML ya llega bloqueado al navegador, sin flash.
 */

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { icons } from "@/components/ui/icons";
import { getModuleStatus } from "@/lib/system-modules-status";
import { MODULES, type ModuleId } from "@/lib/system-modules";

interface ModuleSectionGuardProps {
  moduleId: ModuleId;
  children: ReactNode;
  /**
   * Texto opcional para describir la sección bloqueada (ej. "Catálogo").
   * Si no se pasa, se usa el nombre del módulo.
   */
  sectionLabel?: string;
}

export async function ModuleSectionGuard({
  moduleId,
  children,
  sectionLabel,
}: ModuleSectionGuardProps) {
  const status = await getModuleStatus(moduleId);
  if (status === "active") return <>{children}</>;

  const mod = MODULES.find((m) => m.id === moduleId);
  const moduleName = mod?.name ?? moduleId;
  const label = sectionLabel ?? moduleName;

  return (
    <Card className="space-y-3 border-danger/40 bg-danger/5 text-center py-8">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-danger/15 text-danger [&>svg]:h-6 [&>svg]:w-6">
        {icons.pause}
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-text">
          {label} no disponible
        </p>
        <p className="text-sm text-text-muted">
          El administrador ha pausado temporalmente el módulo {moduleName}.
        </p>
      </div>
    </Card>
  );
}
