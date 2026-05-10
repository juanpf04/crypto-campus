/**
 * Hub de gestión Biblioteca para admin (`/admin/library`).
 *
 * Server Component "delgado": calcula los estados de los módulos library,
 * rooms y print, y los pasa al client `AdminLibraryHubClient`. Cada sección
 * (StatCard / ActionRow) se renderiza solo si su módulo está activo. Las
 * subrutas tienen sus propios guards: `(library-only)/` para library puro,
 * `rooms/` para rooms.
 */

import { getModuleStatus } from "@/lib/system-modules-status";
import { AdminLibraryHubClient } from "./AdminLibraryHubClient";

export default async function AdminLibraryPage() {
  const [libraryStatus, roomsStatus, printStatus] = await Promise.all([
    getModuleStatus("library"),
    getModuleStatus("rooms"),
    getModuleStatus("print"),
  ]);

  return (
    <AdminLibraryHubClient
      libraryActive={libraryStatus === "active"}
      roomsActive={roomsStatus === "active"}
      printActive={printStatus === "active"}
    />
  );
}
