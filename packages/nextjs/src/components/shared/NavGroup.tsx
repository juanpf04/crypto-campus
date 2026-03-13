"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface NavGroupProps {
  title?: string;
  children: ReactNode;
  collapsed?: boolean;
  className?: string;
}

export function NavGroup({ title, children, collapsed = false, className }: NavGroupProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {title && !collapsed && (
        <span className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
          {title}
        </span>
      )}
      {title && collapsed && (
        <div className="mx-auto h-px w-6 bg-border-default" />
      )}
      {children}
    </div>
  );
}
