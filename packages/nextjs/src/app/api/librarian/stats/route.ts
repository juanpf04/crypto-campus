/**
 * GET /api/librarian/stats
 * Agrega las estadísticas del dashboard de bibliotecario en una sola llamada.
 * Acceso: LIBRARIAN y ADMIN (validado en cada action).
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLibraryStats } from "@/actions/library";
import { getRoomStats } from "@/actions/rooms";

export async function GET() {
	const session = await getSession();
	if (!session.userId) {
		return NextResponse.json({ error: "No autenticado" }, { status: 401 });
	}

	try {
		const [libraryStats, roomStats] = await Promise.all([
			getLibraryStats(),
			getRoomStats(),
		]);

		return NextResponse.json({ libraryStats, roomStats });
	} catch (error) {
		console.error("[GET /api/librarian/stats]", error);
		const message = error instanceof Error ? error.message : "Error al obtener estadísticas";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
