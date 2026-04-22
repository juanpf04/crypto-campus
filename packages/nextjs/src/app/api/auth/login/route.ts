import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, SessionData } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // ─── 0. Rate limiting ───
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const { allowed, resetIn } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Inténtalo de nuevo en unos segundos." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } }
    );
  }

  // ─── 1. Leer el body del request ───
  // El frontend envía: { email, password }
  const { email, password } = await req.json();

  // ─── 2. Validación básica ───
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email y contraseña son obligatorios" },
      { status: 400 }
    );
  }

  // ─── 3. Buscar el usuario en la base de datos ───
  // Buscamos por email. Si no existe, devolvemos error genérico.
  // Usamos el mismo mensaje para email inexistente y contraseña incorrecta
  // para no revelar si un email está registrado o no (seguridad).
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Credenciales incorrectas" },
      { status: 401 }
    );
  }

  // ─── 4. Verificar la contraseña ───
  // compare() de bcrypt compara el texto plano con el hash almacenado.
  // Internamente extrae el salt del hash y lo aplica al texto plano
  // para ver si el resultado coincide. No se puede hacer al revés
  // (del hash no se puede obtener la contraseña original).
  const passwordValid = await compare(password, user.password);

  if (!passwordValid) {
    return NextResponse.json(
      { error: "Credenciales incorrectas" },
      { status: 401 }
    );
  }

  // ─── 4.5. Cuenta desactivada ───
  // El admin puede hacer soft-delete de un usuario (User.active = false). En ese
  // caso el login devuelve un mensaje explícito, sin filtrar si la contraseña era
  // correcta o no (el error va después del check de password intencionadamente).
  if (!user.active) {
    return NextResponse.json(
      { error: "Tu cuenta está desactivada. Contacta con el administrador." },
      { status: 403 }
    );
  }

  // ─── 5. Crear la sesión ───
  // iron-session cifra los datos y los guarda en una cookie httpOnly.
  // httpOnly = JavaScript del navegador NO puede leer la cookie (protege contra XSS).
  // Los datos de sesión (userId, address, role) viajan cifrados en cada request.
  // El backend los descifra con SESSION_SECRET para saber quién es el usuario.
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );

  session.userId = user.id;
  session.address = user.address;
  session.role = user.role;

  // save() cifra los datos y establece la cookie en la respuesta
  await session.save();

  // ─── 6. Responder al frontend ───
  // Devolvemos los datos públicos del usuario.
  // La cookie de sesión se envía automáticamente en los headers.
  return NextResponse.json({
    message: "Sesión iniciada correctamente",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
}
