import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";

/**
 * `/admin/library/rooms/*` pertenece al módulo Salas (RoomBooking), no a
 * Biblioteca. El guard correcto es `rooms` y vive aquí, NO en el padre.
 */
export default function AdminLibraryRoomsLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="rooms">{children}</ModuleGuard>;
}
