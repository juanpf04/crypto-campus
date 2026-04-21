import { redirect } from "next/navigation";

// Ruta antigua — ahora /admin/assignments (global con filtros).
export default function DeprecatedAdminAssignmentsRedirect() {
  redirect("/admin/assignments");
}
