import { redirect } from "next/navigation";

// Ruta antigua — las recompensas ahora viven dentro de cada asignatura
// (/professor/subjects/[offeringId]/rewards). Redirigimos al panel.
export default function DeprecatedRewardsRedirect() {
  redirect("/professor");
}
