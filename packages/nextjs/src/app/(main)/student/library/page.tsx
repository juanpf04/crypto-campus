/**
 * Hub de Biblioteca del estudiante (`/student/library`).
 *
 * Server Component "delgado": calcula el estado del módulo Biblioteca y se
 * lo pasa al client `LibraryHubClient`, que renderiza siempre las NavCards
 * de Salas/Impresión y solo bloquea la sección de catálogo+préstamos si
 * Biblioteca está pausada. El detalle de un libro `/student/library/[id]`
 * sí está protegido por su propio `layout.tsx` con ModuleGuard.
 */

import { getModuleStatus } from "@/lib/system-modules-status";
import { LibraryHubClient } from "./LibraryHubClient";

export default async function StudentLibraryPage() {
  const status = await getModuleStatus("library");
  return <LibraryHubClient libraryActive={status === "active"} />;
}
