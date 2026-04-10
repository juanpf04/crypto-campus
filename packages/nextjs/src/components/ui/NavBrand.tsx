"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface NavBrandProps {
  href?: string;
  collapsed?: boolean;
  className?: string;
}

export function NavBrand({ href = "/", collapsed = false, className }: NavBrandProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/5",
        className,
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-text-on-primary font-bold text-sm">
        CC
      </div>
      {!collapsed && (
        <span className="text-lg font-bold text-text whitespace-nowrap">
          CryptoCampus
        </span>
      )}
    </Link>
  );
}
