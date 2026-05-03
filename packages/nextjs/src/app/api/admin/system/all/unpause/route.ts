/**
 * POST /api/admin/system/all/unpause
 * Despausa los 8 contratos del sistema (todos los módulos). Solo ADMIN.
 */

import { NextResponse } from "next/server";
import { unpauseAllModules } from "@/actions/system";

export async function POST() {
	try {
		const result = await unpauseAllModules();
		return NextResponse.json(result, { status: result.ok ? 200 : 207 });
	} catch (error) {
		console.error("[POST /api/admin/system/all/unpause]", error);
		const message = error instanceof Error ? error.message : "Error al despausar el sistema";
		const httpStatus = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status: httpStatus });
	}
}
