"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { icons } from "@/components/ui/icons";
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
      router.replace("/");
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
          "[&_svg]:h-4 [&_svg]:w-4",
        )}
      >
        {icons.logout}
      </button>
    </div>
  );
}
