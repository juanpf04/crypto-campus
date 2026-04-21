import { redirect } from "next/navigation";

// Ruta antigua — ahora /admin/use-requests (global con filtros).
export default function DeprecatedAdminRequestsRedirect() {
  redirect("/admin/use-requests");
}
