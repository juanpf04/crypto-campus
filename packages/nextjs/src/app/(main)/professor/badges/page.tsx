import { redirect } from "next/navigation";

// Ruta antigua — las tareas ahora viven dentro de cada asignatura
// (/professor/subjects/[offeringId]/assignments). Redirigimos al panel.
export default function DeprecatedBadgesRedirect() {
  redirect("/professor");
}
