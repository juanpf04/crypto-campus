import { redirect } from "next/navigation";

// Ruta antigua — ahora /admin/rewards (global con filtros).
export default function DeprecatedAdminRewardsRedirect() {
  redirect("/admin/rewards");
}
