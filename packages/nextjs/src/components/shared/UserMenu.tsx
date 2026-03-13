"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

interface UserMenuProps {
  name: string;
  role: UserRole;
  collapsed?: boolean;
  className?: string;
}

const roleBadgeVariant: Record<UserRole, "info" | "success" | "warning" | "danger"> = {
  STUDENT: "info",
  PROFESSOR: "success",
  LIBRARIAN: "warning",
  ADMIN: "danger",
};

const roleLabel: Record<UserRole, string> = {
  STUDENT: "Estudiante",
  PROFESSOR: "Profesor",
  LIBRARIAN: "Bibliotecario",
  ADMIN: "Admin",
};

export function UserMenu({ name, role, collapsed = false, className }: UserMenuProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Avatar name={name} size="sm" />
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text truncate">{name}</p>
          <Badge variant={roleBadgeVariant[role]}>{roleLabel[role]}</Badge>
        </div>
      )}
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        title="Cerrar sesión"
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors",
          "hover:bg-danger/10 hover:text-danger",
          "disabled:opacity-50",
        )}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  );
}
