/**
 * POST /api/shop/images — Subir imagen de producto.
 *
 * Recibe FormData con campo "file" (JPG, PNG, WebP, max 5MB).
 * Guarda en public/images/shop/ con nombre UUID para evitar colisiones.
 * Devuelve { url: "/images/shop/uuid.ext" }.
 *
 * Acceso: solo admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const UPLOAD_DIR = path.join(process.cwd(), "public", "images", "shop");

export async function POST(req: NextRequest) {
  try {
    // Verificar sesión admin
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId || session.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se ha proporcionado archivo" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usa JPG, PNG o WebP." },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "El archivo supera el límite de 5MB." },
        { status: 400 },
      );
    }

    // Crear directorio si no existe
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generar nombre único
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const fileName = `${randomUUID()}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    // Guardar archivo
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const url = `/images/shop/${fileName}`;
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
