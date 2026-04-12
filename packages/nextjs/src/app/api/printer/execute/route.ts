/**
 * POST /api/printer/execute
 * Ejecuta un trabajo de impresión para el usuario logueado.
 * Acceso: Usuarios autenticados (validado en la Server Action).
 * Body: { printerId, filename, pages, copies?, color?, duplex?, orientation?,
 *         paperSize?, pageRangeFrom?, pageRangeTo?, pagesPerSheet?,
 *         filePages?, fileSize?, filePath? }
 */

import { NextRequest, NextResponse } from "next/server";
import { executeMyPrintJob } from "@/actions/printing";

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const {
			printerId, filename, pages, copies,
			color, duplex, orientation, paperSize,
			pageRangeFrom, pageRangeTo, pagesPerSheet,
			filePages, fileSize, filePath,
		} = body;

		// Validar campos requeridos (la autorización la valida executeMyPrintJob)
		if (!printerId || !filename || !pages) {
			return NextResponse.json(
				{ error: "campos requeridos: printerId, filename, pages" },
				{ status: 400 }
			);
		}

		const result = await executeMyPrintJob({
			printerId,
			filename,
			pages,
			copies,
			color,
			duplex,
			orientation,
			paperSize,
			pageRangeFrom,
			pageRangeTo,
			pagesPerSheet,
			filePages,
			fileSize,
			filePath,
		});

		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		console.error("[POST /api/printer/execute]", error);
		const message = error instanceof Error ? error.message : "Error al ejecutar trabajo de impresión";
		const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
