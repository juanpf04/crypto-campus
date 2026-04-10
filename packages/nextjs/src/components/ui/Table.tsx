"use client";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Piezas atómicas de tabla — se componen libremente.
   Para una tabla "lista para usar" con columns + data, ver
   src/components/DataTable.tsx
   ------------------------------------------------------------------ */

interface TableRootProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableRootProps) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border-default", className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function TableHeader({ children, className }: TableRootProps) {
  return <thead className={cn("", className)}>{children}</thead>;
}

export function TableBody({ children, className }: TableRootProps) {
  return <tbody className={cn("", className)}>{children}</tbody>;
}

interface TableRowProps extends TableRootProps {
  onClick?: () => void;
}

export function TableRow({ children, className, onClick }: TableRowProps) {
  return (
    <tr
      className={cn("border-b border-border-default last:border-b-0 hover:bg-bg/50 transition-colors", className)}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

interface TableCellProps {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}

export function TableHead({ children, className }: TableCellProps) {
  return (
    <th className={cn("px-4 py-3 text-left font-medium text-text-muted bg-bg", className)}>
      {children}
    </th>
  );
}

export function TableCell({ children, className, colSpan }: TableCellProps) {
  return (
    <td className={cn("px-4 py-3 text-text", className)} colSpan={colSpan}>
      {children}
    </td>
  );
}
