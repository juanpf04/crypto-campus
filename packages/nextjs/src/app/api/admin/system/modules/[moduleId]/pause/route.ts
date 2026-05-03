/**
 * POST /api/admin/system/modules/[moduleId]/pause
 * Pausa todos los contratos del módulo indicado. Solo ADMIN.
 */

import { NextRequest, NextResponse } from "next/server";
import { pauseModule } from "@/actions/system";
import type { ModuleId } from "@/lib/system-modules";

type Params = { params: Promise<{ moduleId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
	try {
		const { moduleId } = await params;
		const result = await pauseModule(moduleId as ModuleId);
		return NextResponse.json(result, { status: result.ok ? 200 : 207 });
	} catch (error) {
		console.error("[POST /api/admin/system/modules/[id]/pause]", error);
		const message = error instanceof Error ? error.message : "Error al pausar módulo";
		const httpStatus = message === "No autenticado" ? 401
			: message === "No autorizado" ? 403
			: message.startsWith("Módulo desconocido") ? 404
			: 500;
		return NextResponse.json({ error: message }, { status: httpStatus });
	}
}
