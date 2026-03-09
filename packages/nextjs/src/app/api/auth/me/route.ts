import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // ─── 1. Leer la sesión de la cookie ───
  // Si el usuario está logueado, la cookie contiene userId, address y role
  // cifrados. Si no hay sesión o expiró, userId será undefined.
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );

  // ─── 2. Comprobar si hay sesión activa ───
  // Si no hay userId en la sesión, el usuario no está autenticado.
  if (!session.userId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  // ─── 3. Obtener los datos actualizados del usuario ───
  // Aunque la sesión tiene datos, consultamos la DB para tener
  // la información más reciente (por si el admin cambió el rol, etc).
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      // NO devolvemos: password, address, encryptedKey
    },
  });

  if (!user) {
    // El usuario fue eliminado de la DB pero la sesión sigue activa.
    // Destruimos la sesión huérfana.
    session.destroy();
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 401 }
    );
  }

  // ─── 4. Responder con los datos del usuario ───
  // Este endpoint lo usa el frontend para saber quién está logueado
  // y qué rol tiene (para mostrar/ocultar secciones de la UI).
  return NextResponse.json({ user });
}
