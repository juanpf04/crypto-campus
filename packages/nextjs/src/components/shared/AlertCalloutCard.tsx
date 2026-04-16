"use client";

/**
 * AlertCalloutCard — Callout clicable para alertas contextuales en dashboards.
 *
 * Card con borde coloreado + icono + título + descripción + acción.
 * Toda la card es un Link al `href` destino.
 *
 * Variantes: warning (amarillo), danger (rojo), success (verde), info/primary (azul).
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

type Variant = "warning" | "danger" | "success" | "info" | "primary";

interface AlertCalloutCardProps {
  variant: Variant;
  icon: ReactNode;
  title: string;
  description: string;
  actionText: string;
  href: string;
}

const STYLES: Record<Variant, { border: string; bg: string; iconBg: string; iconText: string; actionText: string }> = {
  warning: { border: "border-warning/50 hover:border-warning", bg: "bg-warning/5", iconBg: "bg-warning/15", iconText: "text-warning", actionText: "text-warning" },
  danger: { border: "border-danger/50 hover:border-danger", bg: "bg-danger/5", iconBg: "bg-danger/15", iconText: "text-danger", actionText: "text-danger" },
  success: { border: "border-success/50 hover:border-success", bg: "bg-success/5", iconBg: "bg-success/15", iconText: "text-success", actionText: "text-success" },
  info: { border: "border-primary/50 hover:border-primary", bg: "bg-primary/5", iconBg: "bg-primary/15", iconText: "text-primary", actionText: "text-primary" },
  primary: { border: "border-primary/50 hover:border-primary", bg: "bg-primary/5", iconBg: "bg-primary/15", iconText: "text-primary", actionText: "text-primary" },
};

export function AlertCalloutCard({ variant, icon, title, description, actionText, href }: AlertCalloutCardProps) {
  const s = STYLES[variant];
  return (
    <Link href={href} className="block">
      <Card className={`flex items-center gap-4 ${s.border} ${s.bg} transition-colors`}>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${s.iconBg} ${s.iconText}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text">{title}</p>
          <p className="text-sm text-text-muted">{description}</p>
        </div>
        <span className={`text-sm font-medium shrink-0 ${s.actionText}`}>{actionText} →</span>
      </Card>
    </Link>
  );
}
