/**
 * POST /api/admin/system/all/pause
 * Pausa los 8 contratos del sistema (todos los módulos). Solo ADMIN.
 * Requiere confirmación reforzada en la UI (type-to-confirm).
 */

import { NextResponse } from "next/server";
import { pauseAllModules } from "@/actions/system";

export async function POST() {
	try {
		const result = await pauseAllModules();
		return NextResponse.json(result, { status: result.ok ? 200 : 207 });
	} catch (error) {
		console.error("[POST /api/admin/system/all/pause]", error);
		const message = error instanceof Error ? error.message : "Error al pausar el sistema";
		const httpStatus = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status: httpStatus });
	}
}
