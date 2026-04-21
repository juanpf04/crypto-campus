import { redirect } from "next/navigation";

// Ruta antigua — crear recompensa ahora es contextual por asignatura.
// El admin debe entrar primero a una asignatura desde /admin/subjects.
export default function DeprecatedAdminNewRewardRedirect() {
  redirect("/admin/subjects");
}
