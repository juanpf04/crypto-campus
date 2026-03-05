import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";

export async function POST() {
  // ─── 1. Obtener la sesión actual ───
  // Leemos la cookie cifrada del request y la desciframos.
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );

  // ─── 2. Destruir la sesión ───
  // destroy() borra todos los datos de la sesión y elimina la cookie.
  // Después de esto, el usuario ya no está autenticado.
  session.destroy();

  // ─── 3. Confirmar al frontend ───
  return NextResponse.json({ message: "Sesión cerrada correctamente" });
}
