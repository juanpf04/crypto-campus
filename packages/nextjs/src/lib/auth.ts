import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

export type Role = "STUDENT" | "PROFESSOR" | "LIBRARIAN" | "ADMIN";

export async function getSession() {
	return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function getRequestSession(req: NextRequest, res: NextResponse) {
	return getIronSession<SessionData>(req, res, sessionOptions);
}

export function ensureAuthenticated(session: SessionData) {
	if (!session.userId) {
		throw new Error("No autorizado");
	}
}

export function ensureRole(session: SessionData, allowed: Role[]) {
	if (!session.userId || !session.role || !allowed.includes(session.role as Role)) {
		throw new Error("No autorizado");
	}
}

export function ensureAdmin(session: SessionData) {
	ensureRole(session, ["ADMIN"]);
}