import { redirect } from "next/navigation";

// Ruta antigua — las solicitudes ahora viven en /professor/use-requests (global)
// o en /professor/subjects/[offeringId]/use-requests (por asignatura).
export default function DeprecatedRewardsRequestsRedirect() {
  redirect("/professor/use-requests");
}
