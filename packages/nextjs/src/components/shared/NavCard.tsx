"use client";

/**
 * NavCard — Card clicable de navegación a una sección destacada.
 *
 * Envuelve un Link en una Card con icono + etiqueta + título + descripción +
 * LinkArrow. Pensado para accesos destacados tipo "Reservar sala", "Imprimir",
 * "Ver historial", etc. Se usa dentro de grids responsivos.
 *
 * - `title` admite ReactNode para permitir formatos tipo "número grande".
 * - `iconSize` ajusta el cuadro del icono: `md` (12×12) para stats compactos,
 *   `lg` (16×16) para accesos protagonistas.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { LinkArrow } from "@/components/shared/LinkArrow";
import { cn } from "@/lib/utils";

interface NavCardProps {
  href: string;
  icon: ReactNode;
  label?: string;
  title: ReactNode;
  description?: ReactNode;
  iconSize?: "md" | "lg";
  className?: string;
}

const iconSizeMap = {
  md: "h-12 w-12 rounded-lg",
  lg: "h-16 w-16 rounded-xl",
};

export function NavCard({
  href,
  icon,
  label,
  title,
  description,
  iconSize = "lg",
  className,
}: NavCardProps) {
  return (
    <Link href={href} className={cn("group", className)}>
      <Card className="relative flex h-full items-center gap-4 transition-colors hover:border-primary/50">
        <div
          className={cn(
            "grid shrink-0 place-items-center bg-primary/10 text-primary",
            iconSizeMap[iconSize],
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          {label && <p className="text-sm font-medium text-text-muted">{label}</p>}
          <div className="text-xl font-bold text-text">{title}</div>
          {description && <div className="mt-1 text-sm text-text-muted">{description}</div>}
        </div>
        <LinkArrow />
      </Card>
    </Link>
  );
}
