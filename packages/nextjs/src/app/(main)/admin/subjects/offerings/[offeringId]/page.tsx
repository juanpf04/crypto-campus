import { redirect } from "next/navigation";

// Ruta antigua — el detalle de una asignatura impartida ahora vive en
// /admin/subjects/[offeringId] (un nivel menos).
export default async function DeprecatedOfferingRedirect({
  params,
}: {
  params: Promise<{ offeringId: string }>;
}) {
  const { offeringId } = await params;
  redirect(`/admin/subjects/${offeringId}`);
}
