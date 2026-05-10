/**
 * GET /api/admin/stats
 * Agrega todas las estadísticas del dashboard de admin en una sola llamada.
 * Acceso: solo ADMIN.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShopStats } from "@/actions/shop";
import { getLibraryStats } from "@/actions/library";
import { getBadgeStats } from "@/actions/badges";
import { getRoomStats } from "@/actions/rooms";
import { listActivePrinters } from "@/actions/printing";

export async function GET() {
	const session = await getSession();
	if (!session.userId || session.role !== "ADMIN") {
		return NextResponse.json({ error: "No autenticado" }, { status: 401 });
	}

	try {
		const [shopStats, libraryStats, badgeStats, roomStats, printers, userGroups, printLogCount] =
			await Promise.all([
				getShopStats(),
				getLibraryStats(),
				getBadgeStats(),
				getRoomStats(),
				listActivePrinters(),
				prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
				// El contador de actividad real debe coincidir con el listado
				// /admin/printing/logs (que filtra históricos).
				prisma.printLog.count({ where: { historical: false } }),
			]);

		const roleCounts = Object.fromEntries(userGroups.map((g) => [g.role, g._count.id]));
		const userCounts = {
			total: userGroups.reduce((acc, g) => acc + g._count.id, 0),
			students: roleCounts["STUDENT"] ?? 0,
			professors: roleCounts["PROFESSOR"] ?? 0,
			librarians: roleCounts["LIBRARIAN"] ?? 0,
			admins: roleCounts["ADMIN"] ?? 0,
		};

		return NextResponse.json({
			shopStats,
			libraryStats,
			badgeStats,
			roomStats,
			userCounts,
			activePrinters: printers.length,
			totalPrintLogs: printLogCount,
		});
	} catch (error) {
		console.error("[GET /api/admin/stats]", error);
		const message = error instanceof Error ? error.message : "Error al obtener estadísticas";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
