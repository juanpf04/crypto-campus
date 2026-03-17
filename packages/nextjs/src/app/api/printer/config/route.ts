/**
 * GET /api/printer/config
 * Obtiene la configuración del contrato Printer.
 * Acceso: Público (solo lectura).
 */

import { NextResponse } from "next/server";
import { getPrinterConfig } from "@/actions/printing";

export async function GET() {
	try {
		const config = await getPrinterConfig();
		return NextResponse.json(config);
	} catch (error) {
		console.error("[GET /api/printer/config]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error al obtener configuración" },
			{ status: 500 }
		);
	}
}
