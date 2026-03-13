"use client";

import { NavBrand } from "@/components/ui/NavBrand";
import { NavItem } from "@/components/ui/NavItem";
import { NavGroup } from "@/components/shared/NavGroup";
import { UserMenu } from "@/components/shared/UserMenu";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

interface SidebarProps {
  name: string;
  role: UserRole;
  collapsed?: boolean;
  className?: string;
}

/* ── Iconos SVG inline (Lucide-style, 20x20) ── */
const icons = {
  home: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  library: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  shop: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  badge: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  ),
  print: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  ),
  users: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  students: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  ),
  reward: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  items: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  loans: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  orders: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
};

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
            { href: `${base}/professor/badges`, icon: icons.badge, label: "Badges" },
            { href: `${base}/professor/rewards`, icon: icons.reward, label: "Recompensas" },
            { href: `${base}/professor/students`, icon: icons.students, label: "Alumnos" },
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
            { href: `${base}/admin/badges`, icon: icons.badge, label: "Badges" },
            { href: `${base}/admin/printing`, icon: icons.print, label: "Impresión" },
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

      {/* User */}
      <div className="border-t border-border-default p-3">
        <UserMenu name={name} role={role} collapsed={collapsed} />
      </div>
    </aside>
  );
}
