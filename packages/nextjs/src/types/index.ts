// Tipos compartidos entre frontend y backend.

export type UserRole = "STUDENT" | "PROFESSOR" | "LIBRARIAN" | "ADMIN";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  address: string;
}
