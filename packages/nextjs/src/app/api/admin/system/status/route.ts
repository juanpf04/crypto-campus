/**
 * GET /api/admin/system/status
 * Devuelve el estado paused() de todos los contratos y deriva el estado
 * por módulo lógico para la UI de "Estado del sistema". Solo ADMIN.
 */

import { NextResponse } from "next/server";
import { getModulesStatus } from "@/actions/system";

export async function GET() {
	try {
		const status = await getModulesStatus();
		return NextResponse.json(status);
	} catch (error) {
		console.error("[GET /api/admin/system/status]", error);
		const message = error instanceof Error ? error.message : "Error al consultar estado del sistema";
		const httpStatus = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status: httpStatus });
	}
}
