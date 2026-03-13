/**
 * session.ts — Configuración de sesión con iron-session.
 *
 * iron-session es una librería que gestiona sesiones stateless usando cookies
 * cifradas. No necesita base de datos para las sesiones: toda la info se
 * guarda dentro de la propia cookie, cifrada con SESSION_SECRET.
 *
 * Flujo:
 * 1. Cuando un usuario hace login, la API route escribe datos en la sesión:
 *    session.userId = user.id; session.address = ...; await session.save();
 * 2. iron-session cifra esos datos con la SESSION_SECRET y los mete en una
 *    cookie llamada "cryptocampus-session".
 * 3. En cada request posterior, el middleware (proxy.ts) o las API routes
 *    leen la cookie, la descifran y acceden a session.userId, etc.
 * 4. Si la cookie no existe o no se puede descifrar → sesión vacía → no autenticado.
 *
 * SessionData define la forma de los datos que se guardan en la sesión:
 * - userId: ID del usuario en la BD (string UUID).
 * - address: Dirección Ethereum del wallet del usuario.
 * - role: Rol del usuario (STUDENT, PROFESSOR, etc.).
 * Todos son opcionales porque la sesión puede estar vacía (no autenticado).
 */

import { SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;   // ID del usuario en PostgreSQL
  address?: string;  // Dirección Ethereum (0x...) del wallet custodial
  role?: string;     // Rol: STUDENT | PROFESSOR | LIBRARIAN | ADMIN
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!, // Clave de cifrado (mín 32 chars)
  cookieName: "cryptocampus-session",    // Nombre de la cookie en el navegador
  cookieOptions: {
    secure: false,    // false para desarrollo local (no HTTPS). En producción: true
    httpOnly: true,   // La cookie NO es accesible desde JavaScript del navegador (protege contra XSS)
    sameSite: "lax",  // Protección CSRF: la cookie solo se envía en navegación del mismo sitio
  },
};
