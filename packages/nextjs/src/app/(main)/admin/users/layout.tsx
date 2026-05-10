import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/**
 * Bloquea /admin/users/* si el módulo Control de acceso (CampusRoles) está
 * pausado. Crear/editar/eliminar usuarios ejecuta tx on-chain (registerUser,
 * removeUser, changeRole), todas con whenNotPaused — si el módulo está
 * pausado las operaciones fallarán; bloqueamos server-side para coherencia.
 */
export default function AdminUsersLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="roles">{children}</ModuleGuard>;
}
