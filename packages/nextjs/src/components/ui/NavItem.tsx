"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface NavItemProps {
  href: string;
  icon?: ReactNode;
  label: string;
  collapsed?: boolean;
  className?: string;
}

export function NavItem({ href, icon, label, collapsed = false, className }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-text-muted hover:bg-border-default/50 hover:text-text",
        className,
      )}
    >
      {icon && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          {icon}
        </span>
      )}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
