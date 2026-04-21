import { redirect } from "next/navigation";

// Ruta antigua — las tareas ahora viven en /admin/assignments (global)
// o en /admin/subjects/[offeringId]/assignments (por asignatura).
export default function DeprecatedAdminBadgesRedirect() {
  redirect("/admin/assignments");
}
