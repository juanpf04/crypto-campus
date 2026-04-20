/**
 * GET /api/student/stats
 * Agrega todos los datos del dashboard de estudiante en una sola llamada.
 * Acceso: usuarios autenticados (cada action valida sesión internamente).
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMyPrinterCredits, getMyPrintsByMonth } from "@/actions/printing";
import { getLibraryBalance, getMyLoans } from "@/actions/library";
import { getMyShopBalance, listMyOrders } from "@/actions/shop";
import { getMyBadgeSummary } from "@/actions/badges";

export async function GET() {
	const session = await getSession();
	if (!session.userId) {
		return NextResponse.json({ error: "No autenticado" }, { status: 401 });
	}

	try {
		const [credits, printsByMonth, libBalance, loans, shopBalance, orders, badgeSummary, printCount] =
			await Promise.all([
				getMyPrinterCredits(),
				getMyPrintsByMonth(),
				getLibraryBalance(),
				getMyLoans(),
				getMyShopBalance(),
				listMyOrders(5, 0),
				getMyBadgeSummary(),
				prisma.printLog.count({ where: { userId: session.userId } }),
			]);

		return NextResponse.json({
			credits,
			printsByMonth,
			libBalance,
			loans,
			shopBalance,
			orders,
			badgeSummary,
			printCount,
		});
	} catch (error) {
		console.error("[GET /api/student/stats]", error);
		const message = error instanceof Error ? error.message : "Error al obtener datos";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
