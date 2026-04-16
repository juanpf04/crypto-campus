/**
 * academic.ts — Server Actions para gestión académica.
 *
 * CRUD de asignaturas, ofertas y matrículas.
 * Solo accesible por ADMIN.
 */

"use server";

import { prisma } from "@/lib/prisma";
import { getSession, ensureRole } from "@/lib/auth";

// ── Asignaturas ──────────────────────────────────────────────────────────

export async function createSubject(input: { name: string; code: string }) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	const name = input.name.trim();
	const code = input.code.trim().toUpperCase();
	if (!name) throw new Error("El nombre es obligatorio");
	if (!code) throw new Error("El código es obligatorio");

	const existing = await prisma.subject.findUnique({ where: { code } });
	if (existing) throw new Error(`Ya existe una asignatura con código ${code}`);

	const subject = await prisma.subject.create({ data: { name, code } });
	return { success: true, subject };
}

export async function updateSubject(id: string, input: { name: string }) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	const name = input.name.trim();
	if (!name) throw new Error("El nombre es obligatorio");

	const subject = await prisma.subject.update({ where: { id }, data: { name } });
	return { success: true, subject };
}

export async function deleteSubject(id: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	const offerings = await prisma.subjectOffering.count({ where: { subjectId: id } });
	if (offerings > 0) throw new Error("No se puede eliminar: tiene ofertas asociadas");

	await prisma.subject.delete({ where: { id } });
	return { success: true };
}

export async function listSubjects() {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	return prisma.subject.findMany({
		include: { _count: { select: { offerings: true } } },
		orderBy: { code: "asc" },
	});
}

export async function getSubject(id: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	const subject = await prisma.subject.findUnique({
		where: { id },
		include: {
			offerings: {
				include: {
					professor: { select: { id: true, name: true, email: true } },
					_count: { select: { enrollments: true } },
					subjectBadge: { select: { id: true } },
				},
				orderBy: [{ academicYear: "desc" }, { group: "asc" }],
			},
		},
	});
	if (!subject) throw new Error("Asignatura no encontrada");
	return subject;
}

// ── Ofertas ──────────────────────────────────────────────────────────────

export async function createOffering(input: {
	subjectId: string;
	professorId: string;
	group: string;
	academicYear: string;
}) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	const group = input.group.trim();
	const academicYear = input.academicYear.trim();
	if (!group) throw new Error("El grupo es obligatorio");
	if (!academicYear) throw new Error("El curso académico es obligatorio");

	const offering = await prisma.subjectOffering.create({
		data: {
			subjectId: input.subjectId,
			professorId: input.professorId,
			group,
			academicYear,
		},
	});
	return { success: true, offering };
}

export async function updateOffering(id: string, input: { group?: string; academicYear?: string }) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	const data: Record<string, string> = {};
	if (input.group !== undefined) data.group = input.group.trim();
	if (input.academicYear !== undefined) data.academicYear = input.academicYear.trim();

	const offering = await prisma.subjectOffering.update({ where: { id }, data });
	return { success: true, offering };
}

export async function deleteOffering(id: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	const [enrollments, subjectBadge] = await Promise.all([
		prisma.enrollment.count({ where: { subjectOfferingId: id } }),
		prisma.subjectBadge.findUnique({ where: { subjectOfferingId: id } }),
	]);
	if (enrollments > 0) throw new Error("No se puede eliminar: tiene matrículas asociadas");
	if (subjectBadge) throw new Error("No se puede eliminar: tiene insignia de asignatura creada");

	await prisma.subjectOffering.delete({ where: { id } });
	return { success: true };
}

export async function listOfferings(subjectId?: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	const where = subjectId ? { subjectId } : {};

	return prisma.subjectOffering.findMany({
		where,
		include: {
			subject: { select: { name: true, code: true } },
			professor: { select: { id: true, name: true, email: true } },
			_count: { select: { enrollments: true } },
		},
		orderBy: [{ academicYear: "desc" }, { group: "asc" }],
	});
}

export async function getOffering(id: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	const offering = await prisma.subjectOffering.findUnique({
		where: { id },
		include: {
			subject: true,
			professor: { select: { id: true, name: true, email: true } },
			enrollments: {
				include: { user: { select: { id: true, name: true, email: true } } },
				orderBy: { user: { name: "asc" } },
			},
		},
	});
	if (!offering) throw new Error("Oferta no encontrada");
	return offering;
}

// ── Matrículas ───────────────────────────────────────────────────────────

export async function enrollStudent(input: { userId: string; subjectOfferingId: string }) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	const existing = await prisma.enrollment.findUnique({
		where: { userId_subjectOfferingId: { userId: input.userId, subjectOfferingId: input.subjectOfferingId } },
	});
	if (existing) throw new Error("El estudiante ya está matriculado en esta oferta");

	const enrollment = await prisma.enrollment.create({
		data: { userId: input.userId, subjectOfferingId: input.subjectOfferingId },
	});
	return { success: true, enrollment };
}

export async function unenrollStudent(enrollmentId: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	await prisma.enrollment.delete({ where: { id: enrollmentId } });
	return { success: true };
}

export async function listAvailableStudents(offeringId: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	const enrolled = await prisma.enrollment.findMany({
		where: { subjectOfferingId: offeringId },
		select: { userId: true },
	});
	const enrolledIds = enrolled.map((e) => e.userId);

	return prisma.user.findMany({
		where: { role: "STUDENT", active: true, id: { notIn: enrolledIds } },
		select: { id: true, name: true, email: true },
		orderBy: { name: "asc" },
	});
}

// ── Helpers para selects ─────────────────────────────────────────────────

export async function listProfessors() {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	return prisma.user.findMany({
		where: { role: "PROFESSOR", active: true },
		select: { id: true, name: true, email: true },
		orderBy: { name: "asc" },
	});
}

export async function listStudentsForAdmin() {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	return prisma.user.findMany({
		where: { role: "STUDENT", active: true },
		select: { id: true, name: true, email: true },
		orderBy: { name: "asc" },
	});
}
