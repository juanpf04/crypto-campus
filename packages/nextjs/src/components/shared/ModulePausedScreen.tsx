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
import { MODULES, type ModuleId, type ModuleStatus } from "@/lib/system-modules";

interface ModulePausedScreenProps {
  moduleId: ModuleId;
  /** Rol del usuario; se usa para el destino del botón "Volver al panel". */
  role: "STUDENT" | "PROFESSOR" | "LIBRARIAN" | "ADMIN" | undefined;
  /**
   * Estado del módulo. "partial" indica que solo algunos contratos del módulo
   * están pausados — útil para mostrar un mensaje específico al admin sobre
   * estado inconsistente.
   */
  status?: ModuleStatus;
}

const ROLE_PANEL: Record<NonNullable<ModulePausedScreenProps["role"]>, string> = {
  STUDENT: "/student",
  PROFESSOR: "/professor",
  LIBRARIAN: "/librarian",
  ADMIN: "/admin",
};

export function ModulePausedScreen({
  moduleId,
  role,
  status = "paused",
}: ModulePausedScreenProps) {
  const mod = MODULES.find((m) => m.id === moduleId);
  const moduleName = mod?.name ?? moduleId;
  const panelHref = role ? ROLE_PANEL[role] : "/";
  const isAdmin = role === "ADMIN";
  const isPartial = status === "partial";

  // Mensajes diferenciados por estado y rol.
  const message = isPartial
    ? isAdmin
      ? `Algunos contratos del módulo ${moduleName} están pausados pero otros no. Revisa el panel de "Estado del sistema" y normaliza la situación.`
      : `Esta funcionalidad está parcialmente pausada. Vuelve a intentarlo más tarde o contacta con un administrador.`
    : isAdmin
      ? `Este módulo está pausado. Para volver a operarlo (incluido el panel de administración) debes despausarlo desde el sistema.`
      : `El administrador ha pausado temporalmente esta funcionalidad. Vuelve a intentarlo más tarde.`;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex min-h-[60vh] items-center justify-center p-6"
    >
      <Card className="max-w-md w-full text-center space-y-5 border-danger/40 bg-danger/5">
        <div
          aria-hidden="true"
          className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-danger/15 text-danger [&>svg]:h-8 [&>svg]:w-8"
        >
          {icons.pause}
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-text">
            {isPartial
              ? `Módulo ${moduleName} en estado inconsistente`
              : `Módulo ${moduleName} no disponible`}
          </h1>
          <p className="text-sm text-text-muted">{message}</p>
        </div>

        <div className="space-y-2">
          {isAdmin && (
            <Link href="/admin/system" className="inline-block w-full">
              <Button variant="primary" className="w-full">
                <span className="flex items-center justify-center gap-2">
                  {icons.pause} Ir a estado del sistema
                </span>
              </Button>
            </Link>
          )}
          <Link href={panelHref} className="inline-block w-full">
            <Button
              variant={isAdmin ? "outline" : "primary"}
              className="w-full"
            >
              <span className="flex items-center justify-center gap-2">
                {icons.home} Volver al panel
              </span>
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
