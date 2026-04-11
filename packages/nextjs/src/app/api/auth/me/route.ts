import { NextResponse } from "next/server";
import { getSession, ensureAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  ensureAuthenticated(session);

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
