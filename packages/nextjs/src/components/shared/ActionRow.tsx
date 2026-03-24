"use client";

/**
 * ActionRow — Fila clicable de acciones rápidas para paneles de admin.
 *
 * Se usa dentro de una Card (p-0, overflow-hidden) para crear una
 * tabla estilizada de acciones con icono, título, descripción, stat y flecha.
 *
 * Reutilizable en: admin/printing, admin/shop, admin/library, etc.
 */

import Link from "next/link";
import { LinkArrow } from "@/components/shared/LinkArrow";
import type { ReactNode } from "react";

interface ActionRowProps {
  /** URL de destino */
  href: string;
  /** Icono representativo */
  icon: ReactNode;
  /** Título de la acción */
  title: string;
  /** Descripción breve */
  description: string;
  /** Valor rápido mostrado a la derecha */
  stat: string | number;
  /** Si es la última fila, no muestra borde inferior */
  isLast?: boolean;
}

export function ActionRow({ href, icon, title, description, stat, isLast }: ActionRowProps) {
  return (
    <Link href={href} className="group">
      <div
        className={`relative flex items-center gap-4 px-5 py-4 transition-colors hover:bg-primary/5 ${
          !isLast ? "border-b border-border-default" : ""
        }`}
      >
        {/* Icono */}
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
          {icon}
        </div>

        {/* Título + descripción */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text">{title}</p>
          <p className="text-sm text-text-muted">{description}</p>
        </div>

        {/* Stat rápido */}
        <span className="text-sm font-medium text-text-muted shrink-0">
          {stat}
        </span>

        {/* Flecha ↗ */}
        <LinkArrow variant="hover" size="md" className="relative right-auto top-auto" />
      </div>
    </Link>
  );
}
