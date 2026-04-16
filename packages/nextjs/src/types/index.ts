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

export type ServiceSection = "library" | "badges" | "shop" | "printing" | "rooms" | "loans";
export type ServiceRoute = ServiceSection | "shop/cart";

export const ROLE_FOLDER_BY_USER_ROLE: Record<UserRole, string> = {
  STUDENT: "student",
  PROFESSOR: "professor",
  LIBRARIAN: "librarian",
  ADMIN: "admin",
};

export const ROLE_FOLDERS = Object.values(ROLE_FOLDER_BY_USER_ROLE);

export const ROUTE_ACCESS_BY_SECTION: Record<ServiceSection, UserRole[]> = {
  library: ["STUDENT", "LIBRARIAN", "ADMIN"],
  badges: ["STUDENT", "PROFESSOR", "ADMIN"],
  shop: ["STUDENT", "ADMIN"],
  printing: ["STUDENT", "LIBRARIAN", "ADMIN"],
  rooms: ["STUDENT", "LIBRARIAN", "ADMIN"],
  loans: ["STUDENT", "LIBRARIAN", "ADMIN"],
};

export const ROUTE_ACCESS_BY_SERVICE: Record<ServiceRoute, UserRole[]> = {
  ...ROUTE_ACCESS_BY_SECTION,
  "shop/cart": ["STUDENT", "ADMIN"],
};

export const TARGET_PATH_BY_SERVICE_AND_ROLE: Record<ServiceRoute, Partial<Record<UserRole, string>>> = {
  library: {
    STUDENT: "/student/library",
    LIBRARIAN: "/librarian/items",
    ADMIN: "/admin/library/items",
  },
  badges: {
    STUDENT: "/student/badges",
    PROFESSOR: "/professor/badges",
    ADMIN: "/admin/badges",
  },
  shop: {
    STUDENT: "/student/shop",
    ADMIN: "/admin/shop/products",
  },
  printing: {
    STUDENT: "/student/library/printing",
    LIBRARIAN: "/librarian/printing",
    ADMIN: "/admin/printing",
  },
  rooms: {
    STUDENT: "/student/library/rooms",
    LIBRARIAN: "/librarian/rooms",
    ADMIN: "/admin/library/rooms",
  },
  loans: {
    STUDENT: "/student/library",
    LIBRARIAN: "/librarian/loans",
    ADMIN: "/admin/library/loans",
  },
  "shop/cart": {
    STUDENT: "/student/shop/cart",
    ADMIN: "/admin/shop/products",
  },
};

/**
 * Resuelve una returnUrl genérica a la ruta final por rol.
 * Si el rol no puede acceder o la ruta no existe, hace fallback al dashboard del rol.
 */
export function resolveRoleRoute(returnUrl: string | null | undefined, role: UserRole): string {
  const roleRoot = `/${ROLE_FOLDER_BY_USER_ROLE[role]}`;

  if (!returnUrl) return roleRoot;

  const [pathOnly] = returnUrl.split("?");
  const normalized = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  const segments = normalized.split("/").filter(Boolean);

  const firstSegment = segments[0];
  const cleanSegments = firstSegment && ROLE_FOLDERS.includes(firstSegment)
    ? segments.slice(1)
    : segments;

  if (cleanSegments.length === 0) return roleRoot;

  const section = cleanSegments[0] as ServiceSection;
  const routeKey = section === "shop" && cleanSegments[1] === "cart"
    ? "shop/cart"
    : section;

  const allowedRoles = ROUTE_ACCESS_BY_SERVICE[routeKey as ServiceRoute];
  if (!allowedRoles || !allowedRoles.includes(role)) return roleRoot;

  const basePath = TARGET_PATH_BY_SERVICE_AND_ROLE[routeKey as ServiceRoute]?.[role];
  if (!basePath) return roleRoot;

  const remaining = routeKey === "shop/cart" ? cleanSegments.slice(2) : cleanSegments.slice(1);
  if (remaining.length === 0) return basePath;

  return `${basePath}/${remaining.join("/")}`;
}

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
