"use client";

import { NavBrand } from "@/components/ui/NavBrand";
import { NavItem } from "@/components/ui/NavItem";
import { NavGroup } from "@/components/shared/NavGroup";
import { UserMenu } from "@/components/shared/UserMenu";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";

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
  const base = `/${role.toLowerCase()}`;

  switch (role) {
    case "STUDENT":
      return [
        {
          title: "Principal",
          items: [
            { href: base, icon: icons.home, label: "Panel" },
          ],
        },
        {
          title: "Servicios",
          items: [
            { href: `${base}/library`, icon: icons.library, label: "Biblioteca" },
            { href: `${base}/badges`, icon: icons.badge, label: "Insignias" },
            { href: `${base}/shop`, icon: icons.shop, label: "Tienda" },
          ],
        },
      ];

    case "PROFESSOR":
      return [
        {
          title: "Principal",
          items: [
            { href: base, icon: icons.home, label: "Panel" },
          ],
        },
        {
          title: "Gestión académica",
          items: [
            { href: `${base}/badges`, icon: icons.badge, label: "Insignias" },
            { href: `${base}/rewards`, icon: icons.reward, label: "Recompensas" },
            { href: `${base}/students`, icon: icons.student, label: "Alumnos" },
          ],
        },
      ];

    case "LIBRARIAN":
      return [
        {
          title: "Principal",
          items: [
            { href: base, icon: icons.home, label: "Panel" },
          ],
        },
        {
          title: "Biblioteca",
          items: [
            { href: `${base}/items`, icon: icons.items, label: "Catálogo" },
            { href: `${base}/loans`, icon: icons.loans, label: "Préstamos" },
            { href: `${base}/rooms`, icon: icons.rooms, label: "Salas" },
            { href: `${base}/printing`, icon: icons.print, label: "Impresión" },
          ],
        },
      ];

    case "ADMIN":
      return [
        {
          title: "Principal",
          items: [
            { href: base, icon: icons.home, label: "Panel" },
          ],
        },
        {
          title: "Administración",
          items: [
            { href: `${base}/users`, icon: icons.users, label: "Usuarios" },
            { href: `${base}/subjects`, icon: icons.items, label: "Asignaturas" },
          ],
        },
        {
          title: "Biblioteca",
          items: [
            { href: `${base}/library`, icon: icons.library, label: "Biblioteca" },
          ],
        },
        {
          title: "Tienda",
          items: [
            { href: `${base}/shop`, icon: icons.shop, label: "Tienda" },
          ],
        },
        {
          title: "Otros",
          items: [
            { href: `${base}/badges`, icon: icons.badge, label: "Insignias" },
            { href: `${base}/printing`, icon: icons.print, label: "Impresión" },
          ],
        },
      ];
  }
}

export function Sidebar({ name, role, collapsed = false, className }: SidebarProps) {
  const groups = getNavGroups(role);

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
        <ThemeSwitcher collapsed={collapsed} />
        <UserMenu name={name} role={role} collapsed={collapsed} />
      </div>

    </aside>
  );
}
