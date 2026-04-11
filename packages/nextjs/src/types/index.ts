/**
 * types/index.ts — Tipos TypeScript compartidos entre frontend y backend.
 *
 * Estos tipos se usan tanto en las API routes (servidor) como en los
 * componentes React (cliente) para mantener consistencia de tipos.
 *
 * UserRole: Los 4 roles posibles en el sistema CryptoCampus.
 * Cada rol tiene permisos distintos tanto en el frontend (qué ve)
 * como en la blockchain (qué funciones de contratos puede ejecutar).
 * - STUDENT: Alumno, puede usar servicios (imprimir, pedir libros, comprar).
 * - PROFESSOR: Profesor, puede gestionar contenido académico.
 * - LIBRARIAN: Bibliotecario, puede gestionar préstamos de libros.
 * - ADMIN: Administrador, acceso total al sistema.
 *
 * SessionUser: Datos del usuario que se pasan al frontend tras el login.
 * Representa la información que el frontend necesita para funcionar:
 * - id: UUID del usuario en PostgreSQL.
 * - email: Email institucional (@ucm.es).
 * - name: Nombre completo del usuario.
 * - role: Su rol en el sistema (determina qué ve en el dashboard).
 * - address: Dirección Ethereum de su wallet custodial (0x...).
 */

export type UserRole = "STUDENT" | "PROFESSOR" | "LIBRARIAN" | "ADMIN";

export interface AuthUser {
  id: string;      // UUID en PostgreSQL
  email: string;   // Email institucional (@ucm.es)
  name: string;    // Nombre completo
  role: UserRole;  // Rol autenticado para autorización/UI
}

export interface SessionUser {
  id: string;      // UUID en PostgreSQL
  email: string;   // Email institucional (@ucm.es)
  name: string;    // Nombre completo
  role: UserRole;  // Rol en el sistema → determina permisos y UI
  address: string; // Dirección Ethereum del wallet custodial (0x...)
}
