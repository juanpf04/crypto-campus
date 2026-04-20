import { redirect } from "next/navigation";

// Ruta antigua — para crear una recompensa, el profesor debe entrar primero
// a una asignatura concreta desde el sidebar.
export default function DeprecatedNewRewardRedirect() {
  redirect("/professor");
}
