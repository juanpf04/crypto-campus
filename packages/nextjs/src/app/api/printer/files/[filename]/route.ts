/**
 * GET /api/printer/files/[filename]
 * Sirve un archivo subido para impresión desde la carpeta de uploads.
 *
 * Acceso: Usuarios autenticados (el archivo debe pertenecer al usuario,
 * o el usuario debe ser ADMIN para ver archivos de otros).
 *
 * Los archivos se conservan 24 horas tras la impresión.
 * Si el archivo no existe o ha expirado, devuelve 404.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const UPLOAD_DIR = join(process.cwd(), "uploads", "prints");

/** Mapea extensiones a content-types */
const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  // Verificar autenticación
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { filename } = await params;

  // Prevenir path traversal
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return NextResponse.json({ error: "Nombre de archivo no válido" }, { status: 400 });
  }

  // Verificar ownership: el archivo debe pertenecer al usuario o el usuario debe ser ADMIN
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    const log = await prisma.printLog.findFirst({ where: { filePath: { contains: filename } } });
    if (log) {
      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (log.userId !== session.userId && user?.role !== "ADMIN") {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  const filePath = join(UPLOAD_DIR, filename);

  try {
    // Verificar que el archivo existe
    const fileStat = await stat(filePath);

    // Verificar que no ha expirado (24 horas)
    const ageMs = Date.now() - fileStat.mtimeMs;
    const maxAgeMs = 24 * 60 * 60 * 1000;
    if (ageMs > maxAgeMs) {
      return NextResponse.json(
        { error: "El archivo ha expirado. Los documentos se conservan 24 horas." },
        { status: 404 },
      );
    }

    // Leer y servir el archivo
    const buffer = await readFile(filePath);
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME_MAP[ext] ?? "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Archivo no encontrado" },
      { status: 404 },
    );
  }
}
