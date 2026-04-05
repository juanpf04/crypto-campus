"use client";

import { useState } from "react";
import { NavBrand } from "@/components/ui/NavBrand";
import { NavItem } from "@/components/ui/NavItem";
import { NavGroup } from "@/components/shared/NavGroup";
import { UserMenu } from "@/components/shared/UserMenu";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import { InfoPanel } from "@/components/shared/InfoPanel";
import { cn } from "@/lib/utils";
import { icons } from "@/components/ui/icons";
import type { UserRole } from "@/types";

interface SidebarProps {
  name: string;
  role: UserRole;
  collapsed?: boolean;
  className?: string;
}

/** Devuelve los grupos de navegación según el rol del usuario */
function getNavGroups(role: UserRole) {
  const base = "/dashboard";

  switch (role) {
    case "STUDENT":
      return [
        {
          title: "Principal",
          items: [
            { href: base, icon: icons.home, label: "Dashboard" },
          ],
        },
        {
          title: "Servicios",
          items: [
            { href: `${base}/student/printing`, icon: icons.print, label: "Impresión" },
            { href: `${base}/student/library`, icon: icons.library, label: "Biblioteca" },
            { href: `${base}/student/badges`, icon: icons.badge, label: "Insignias" },
            { href: `${base}/student/shop`, icon: icons.shop, label: "Tienda" },
          ],
        },
      ];

    case "PROFESSOR":
      return [
        {
          title: "Principal",
          items: [
            { href: base, icon: icons.home, label: "Dashboard" },
          ],
        },
        {
          title: "Gestión académica",
          items: [
            { href: `${base}/professor/badges`, icon: icons.badge, label: "Insignias" },
            { href: `${base}/professor/rewards`, icon: icons.reward, label: "Recompensas" },
            { href: `${base}/professor/students`, icon: icons.student, label: "Alumnos" },
          ],
        },
      ];

    case "LIBRARIAN":
      return [
        {
          title: "Principal",
          items: [
            { href: base, icon: icons.home, label: "Dashboard" },
          ],
        },
        {
          title: "Biblioteca",
          items: [
            { href: `${base}/librarian/items`, icon: icons.items, label: "Catálogo" },
            { href: `${base}/librarian/loans`, icon: icons.loans, label: "Préstamos" },
            { href: `${base}/librarian/rooms`, icon: icons.rooms, label: "Salas" },
          ],
        },
      ];

    case "ADMIN":
      return [
        {
          title: "Principal",
          items: [
            { href: base, icon: icons.home, label: "Dashboard" },
          ],
        },
        {
          title: "Administración",
          items: [
            { href: `${base}/admin/users`, icon: icons.users, label: "Usuarios" },
          ],
        },
        {
          title: "Biblioteca",
          items: [
            { href: `${base}/admin/library`, icon: icons.library, label: "Biblioteca" },
          ],
        },
        {
          title: "Tienda",
          items: [
            { href: `${base}/admin/shop`, icon: icons.shop, label: "Tienda" },
          ],
        },
        {
          title: "Otros",
          items: [
            { href: `${base}/admin/badges`, icon: icons.badge, label: "Insignias" },
            { href: `${base}/admin/printing`, icon: icons.print, label: "Impresión" },
          ],
        },
      ];
  }
}

export function Sidebar({ name, role, collapsed = false, className }: SidebarProps) {
  const groups = getNavGroups(role);
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border-default bg-card transition-all duration-300",
        collapsed ? "w-[68px]" : "w-64",
        className,
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center border-b border-border-default px-3">
        <NavBrand collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {groups.map((group) => (
          <NavGroup key={group.title} title={group.title} collapsed={collapsed}>
            {group.items.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
              />
            ))}
          </NavGroup>
        ))}
      </nav>

      {/* Info + Tema + User */}
      <div className="border-t border-border-default p-3 space-y-1">
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-primary/5 hover:text-text cursor-pointer",
            collapsed && "justify-center px-0",
          )}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          {!collapsed && <span>Normas de uso</span>}
        </button>
        <ThemeSwitcher collapsed={collapsed} />
        <UserMenu name={name} role={role} collapsed={collapsed} />
      </div>

      <InfoPanel open={infoOpen} onClose={() => setInfoOpen(false)} />
    </aside>
  );
}
