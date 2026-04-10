/**
 * proxy.ts — Middleware de autenticación de Next.js.
 *
 * Protege las rutas de rol (/{role}/*) y gestiona redirecciones:
 * - Usuarios no autenticados → /login?returnUrl=...
 * - Usuarios autenticados en /login o /register → /{su_rol}
 * - Usuarios accediendo a rutas de otros roles → /{su_rol}
 */

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/session";

/** Carpetas de rol que requieren autenticación y coincidencia con session.role */
const ROLE_FOLDERS = ["student", "professor", "librarian", "admin"] as const;

export default async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  const isAuthenticated = !!session.userId;
  const { pathname } = req.nextUrl;

  // ¿Es una ruta protegida por rol? (ej: /student/*, /admin/*)
  const isRolePath = ROLE_FOLDERS.some(f => pathname.startsWith(`/${f}`));

  // Regla 1: Rutas de rol sin autenticación → login con returnUrl
  if (isRolePath && !isAuthenticated) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Regla 2: Ya autenticado → no mostrar login/register
  if ((pathname === "/login" || pathname === "/register") && isAuthenticated) {
    const role = (session.role as string)?.toLowerCase() || "student";
    return NextResponse.redirect(new URL(`/${role}`, req.url));
  }

  // Regla 3: Protección por rol — impide acceder a carpetas de otros roles
  if (isAuthenticated && session.role && isRolePath) {
    const userFolder = (session.role as string).toLowerCase();
    for (const folder of ROLE_FOLDERS) {
      if (folder !== userFolder && pathname.startsWith(`/${folder}`)) {
        return NextResponse.redirect(new URL(`/${userFolder}`, req.url));
      }
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/student/:path*",
    "/professor/:path*",
    "/librarian/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
