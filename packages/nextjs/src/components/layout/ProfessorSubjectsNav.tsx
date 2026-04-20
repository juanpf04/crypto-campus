"use client";

/**
 * ProfessorSubjectsNav — Sección del sidebar con las asignaturas que imparte
 * el profesor. Cada asignatura es un grupo colapsable con subsecciones
 * (Resumen, Tareas, Recompensas, Alumnos, Solicitudes).
 *
 * Comportamiento: la asignatura activa (según el pathname) se auto-expande.
 * Las demás quedan colapsadas; pueden expandirse manualmente.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavGroup } from "@/components/shared/NavGroup";
import { NavItem } from "@/components/ui/NavItem";
import { Skeleton } from "@/components/ui/Skeleton";
import { icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface Offering {
  id: string;
  group: string;
  academicYear: string;
  subject: { name: string; code: string };
  _count: { enrollments: number };
}

interface ProfessorSubjectsNavProps {
  collapsed?: boolean;
}

const SUBSECTIONS = [
  { key: "", label: "Resumen", icon: icons.home },
  { key: "/assignments", label: "Tareas", icon: icons.task },
  { key: "/rewards", label: "Recompensas", icon: icons.reward },
  { key: "/students", label: "Alumnos", icon: icons.student },
  { key: "/use-requests", label: "Solicitudes", icon: icons.pending },
] as const;

export function ProfessorSubjectsNav({ collapsed = false }: ProfessorSubjectsNavProps) {
  const pathname = usePathname();
  const [offerings, setOfferings] = useState<Offering[] | null>(null);
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/badges/subject-offerings");
        if (res.ok && !cancelled) setOfferings(await res.json());
      } catch { /* no-op */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Detecta la asignatura activa a partir del pathname
  const activeOfferingId = useMemo(() => {
    const match = pathname.match(/^\/professor\/subjects\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  function toggle(offeringId: string) {
    setManuallyExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(offeringId)) next.delete(offeringId);
      else next.add(offeringId);
      return next;
    });
  }

  if (!offerings) {
    return (
      <NavGroup title="Mis asignaturas" collapsed={collapsed}>
        {!collapsed && (
          <div className="space-y-2 px-3 py-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        )}
      </NavGroup>
    );
  }

  if (offerings.length === 0) {
    return (
      <NavGroup title="Mis asignaturas" collapsed={collapsed}>
        {!collapsed && (
          <p className="px-3 py-2 text-xs text-text-muted italic">
            No impartes ninguna asignatura todavía.
          </p>
        )}
      </NavGroup>
    );
  }

  return (
    <NavGroup title="Mis asignaturas" collapsed={collapsed}>
      {offerings.map((off) => {
        const isActive = off.id === activeOfferingId;
        const isExpanded = isActive || manuallyExpanded.has(off.id);
        const basePath = `/professor/subjects/${off.id}`;

        // Colapsado (sidebar collapsed): solo mostrar icono link al resumen
        if (collapsed) {
          return (
            <Link
              key={off.id}
              href={basePath}
              title={`${off.subject.code} · ${off.group}`}
              className={cn(
                "flex h-9 w-full items-center justify-center rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:bg-border-default/50 hover:text-text",
              )}
            >
              {icons.badge}
            </Link>
          );
        }

        return (
          <div key={off.id} className="flex flex-col">
            {/* Header: expand/collapse toggle + link al resumen */}
            <div
              className={cn(
                "group flex items-center gap-1 rounded-lg pr-1 transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:bg-border-default/50 hover:text-text",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(off.id)}
                className="flex h-8 w-6 shrink-0 items-center justify-center rounded-l-lg cursor-pointer"
                aria-label={isExpanded ? "Colapsar" : "Expandir"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    isExpanded && "rotate-90",
                  )}
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <Link
                href={basePath}
                className="flex-1 min-w-0 py-1.5 text-sm font-medium truncate"
                title={`${off.subject.name} (${off.subject.code} · ${off.group})`}
              >
                {off.subject.code} · {off.group}
              </Link>
            </div>

            {/* Subsecciones */}
            {isExpanded && (
              <div className="mt-0.5 ml-5 flex flex-col gap-0.5 border-l border-border-default pl-2">
                {SUBSECTIONS.map((sub) => {
                  const href = `${basePath}${sub.key}`;
                  return (
                    <NavItem
                      key={sub.key || "resumen"}
                      href={href}
                      icon={sub.icon}
                      label={sub.label}
                      collapsed={false}
                      className="py-1.5 text-xs"
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </NavGroup>
  );
}
