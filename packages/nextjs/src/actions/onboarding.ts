"use server";

import { prisma } from "@/lib/prisma";
import { getSession, ensureRole } from "@/lib/auth";

/** Marca el onboarding del estudiante autenticado como completado. */
export async function completeOnboarding(): Promise<void> {
	const session = await getSession();
	ensureRole(session, ["STUDENT"]);

	await prisma.user.update({
		where: { id: session.userId! },
		data: { onboardingCompleted: true },
	});
}
