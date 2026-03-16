"use client";

/**
 * Enlace de navegación "volver" con flecha e icono animado.
 *
 * Componente atómico reutilizable para cualquier página que necesite
 * un enlace de retorno a la vista anterior. La flecha se desplaza
 * suavemente a la izquierda al hacer hover para dar feedback visual.
 *
 * Uso:
 *   <BackLink href="/dashboard/admin/users" label="Volver a usuarios" />
 */

import Link from "next/link";
import { cn } from "@/lib/utils";

interface BackLinkProps {
  /** Ruta de destino */
  href: string;
  /** Texto del enlace */
  label: string;
  className?: string;
}

export function BackLink({ href, label, className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 text-sm font-medium text-text-muted",
        "transition-colors hover:text-primary",
        className,
      )}
    >
      {/* Flecha — se desplaza a la izquierda en hover */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 transition-transform group-hover:-translate-x-1"
      >
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      {label}
    </Link>
  );
}
