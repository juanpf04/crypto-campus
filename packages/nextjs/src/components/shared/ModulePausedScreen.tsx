/**
 * ModulePausedScreen — Pantalla mostrada cuando un módulo está pausado.
 *
 * Server Component. Lo renderiza <ModuleGuard> en lugar de los children
 * cuando detecta que el módulo asignado a la ruta está pausado y el usuario
 * no es admin. Ofrece una salida explícita al panel del rol.
 */

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { icons } from "@/components/ui/icons";
import { MODULES, type ModuleId } from "@/lib/system-modules";

interface ModulePausedScreenProps {
  moduleId: ModuleId;
  /** Rol del usuario; se usa para el destino del botón "Volver al panel". */
  role: "STUDENT" | "PROFESSOR" | "LIBRARIAN" | "ADMIN" | undefined;
}

const ROLE_PANEL: Record<NonNullable<ModulePausedScreenProps["role"]>, string> = {
  STUDENT: "/student",
  PROFESSOR: "/professor",
  LIBRARIAN: "/librarian",
  ADMIN: "/admin",
};

export function ModulePausedScreen({ moduleId, role }: ModulePausedScreenProps) {
  const mod = MODULES.find((m) => m.id === moduleId);
  const moduleName = mod?.name ?? moduleId;
  const panelHref = role ? ROLE_PANEL[role] : "/";

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md w-full text-center space-y-5 border-danger/40 bg-danger/5">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-danger/15 text-danger [&>svg]:h-8 [&>svg]:w-8">
          {icons.pause}
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-text">
            Módulo {moduleName} no disponible
          </h1>
          <p className="text-sm text-text-muted">
            El administrador ha pausado temporalmente esta funcionalidad. Vuelve a intentarlo más tarde.
          </p>
        </div>

        <Link href={panelHref} className="inline-block w-full">
          <Button variant="primary" className="w-full">
            <span className="flex items-center justify-center gap-2">
              {icons.home} Volver al panel
            </span>
          </Button>
        </Link>
      </Card>
    </div>
  );
}
