/**
 * POST /api/printer/upload
 * Sube un archivo para impresión y lo guarda temporalmente en el servidor.
 * Devuelve la ruta temporal y el nombre original.
 *
 * Acceso: Usuarios autenticados.
 * Body: FormData con campo "file".
 * Formatos aceptados: PDF, imágenes, Word, Excel, PowerPoint, texto.
 * Tamaño máximo: 50 MB.
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";

const ALLOWED_TYPES = [
	"application/pdf",
	"image/jpeg",
	"image/png",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"text/plain",
];
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
const UPLOAD_DIR = join(process.cwd(), "uploads", "prints");

export async function POST(req: NextRequest) {
	try {
		// Verificar autenticación
		const session = await getSession();
		if (!session.userId) {
			return NextResponse.json({ error: "No autenticado" }, { status: 401 });
		}

		const formData = await req.formData();
		const file = formData.get("file") as File | null;

		if (!file) {
			return NextResponse.json({ error: "No se ha proporcionado un archivo" }, { status: 400 });
		}

		// Validar tipo
		if (!ALLOWED_TYPES.includes(file.type)) {
			return NextResponse.json(
				{ error: "Formato no admitido. Usa PDF, Word, Excel, PowerPoint, imágenes o texto." },
				{ status: 400 },
			);
		}

		// Validar tamaño
		if (file.size > MAX_SIZE) {
			return NextResponse.json(
				{ error: "El archivo supera el tamaño máximo de 50 MB" },
				{ status: 400 },
			);
		}

		// Crear directorio si no existe
		await mkdir(UPLOAD_DIR, { recursive: true });

		// Guardar archivo con nombre UUID para evitar colisiones
		const ext = file.name.split(".").pop() ?? "bin";
		const savedName = `${randomUUID()}.${ext}`;
		const filePath = join(UPLOAD_DIR, savedName);
		const buffer = Buffer.from(await file.arrayBuffer());
		await writeFile(filePath, buffer);

		return NextResponse.json({
			filePath,
			fileName: file.name,
			fileSize: file.size,
			mimeType: file.type,
		});
	} catch (error) {
		console.error("[POST /api/printer/upload]", error);
		return NextResponse.json(
			{ error: "Error al subir el archivo" },
			{ status: 500 },
		);
	}
}
