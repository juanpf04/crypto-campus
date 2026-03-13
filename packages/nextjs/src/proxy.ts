/**
 * proxy.ts — Middleware de autenticación de Next.js.
 *
 * Este archivo actúa como middleware: se ejecuta ANTES de que Next.js
 * procese cada request que coincida con el `matcher` (ver abajo).
 * Su objetivo es proteger rutas y redirigir según el estado de autenticación.
 *
 * Flujo para cada request entrante:
 *
 * 1. Next.js intercepta la request y la pasa a esta función.
 *
 * 2. Se lee la sesión de la cookie "cryptocampus-session" usando iron-session.
 *    Si la cookie existe y es válida → session.userId tiene un valor.
 *    Si no existe o expiró → session.userId es undefined.
 *
 * 3. Se evalúan las reglas de redirección:
 *
 *    a) PROTECCIÓN DEL DASHBOARD:
 *       Si el usuario intenta acceder a /dashboard/* sin estar autenticado
 *       → se le redirige a /login.
 *       Esto evita que usuarios no logueados vean el contenido privado.
 *
 *    b) REDIRECCIÓN DE USUARIOS YA AUTENTICADOS:
 *       Si el usuario YA está logueado e intenta ir a /login o /register
 *       → se le redirige a /dashboard.
 *       No tiene sentido mostrar el login a alguien que ya tiene sesión.
 *
 *    c) SI NO APLICA NINGUNA REGLA:
 *       Se deja pasar la request sin modificar (NextResponse.next()).
 *
 * El `matcher` al final define en qué rutas se ejecuta este middleware.
 * Solo se activa para /dashboard/*, /login y /register.
 * El resto de rutas (/, /api/*, etc.) pasan sin verificación.
 */

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/session";

export default async function proxy(req: NextRequest) {
  // Crear una respuesta "pass-through" (dejar pasar) como base
  const res = NextResponse.next();

  // Leer la sesión desde la cookie cifrada
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  // ¿Tiene userId? → está autenticado. ¿No? → no lo está.
  const isAuthenticated = !!session.userId;
  const { pathname } = req.nextUrl;

  // Regla 1: Proteger /dashboard — solo usuarios autenticados
  if (pathname.startsWith("/dashboard") && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Regla 2: Si ya está logueado, no mostrar login/register
  if ((pathname === "/login" || pathname === "/register") && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Sin reglas aplicables → dejar pasar la request
  return res;
}

/**
 * matcher — Define en qué rutas se ejecuta este middleware.
 * :path* es un wildcard que incluye sub-rutas (ej: /dashboard/profile).
 * Rutas no listadas aquí (/, /api/*, /about, etc.) NO pasan por el middleware.
 */
export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
