import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Ruta antigua del detalle de tarea. Buscamos el offeringId y redirigimos a
// la ruta nueva anidada dentro de la asignatura.
export default async function DeprecatedAssignmentDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    select: { subjectBadge: { select: { subjectOfferingId: true } } },
  });
  if (!assignment) redirect("/professor");
  redirect(`/professor/subjects/${assignment.subjectBadge.subjectOfferingId}/assignments/${id}`);
}
