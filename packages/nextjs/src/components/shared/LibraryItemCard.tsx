"use client";

/**
 * LibraryItemCard — Tarjeta de ítem de biblioteca para el catálogo del estudiante.
 * Molécula que compone Card + Badge + Button + Link.
 * La tarjeta es clicable (navega al detalle), el botón de préstamo tiene stopPropagation.
 */

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TYPE_LABELS } from "@/lib/library-constants";

interface LibraryItemCardProps {
  id: string;
  title: string;
  type: string;
  creator: string | null;
  description: string | null;
  totalCopies: number;
  onRequestLoan: () => void;
  requesting?: boolean;
  /** Base URL para el detalle (por defecto /dashboard/student/library) */
  detailBase?: string;
}

export function LibraryItemCard({
  id,
  title,
  type,
  creator,
  description,
  totalCopies,
  onRequestLoan,
  requesting,
  detailBase = "/dashboard/student/library",
}: LibraryItemCardProps) {
  return (
    <Link href={`${detailBase}/${id}`} className="block group">
      <Card className="p-4 space-y-3 transition-colors group-hover:border-primary/50">
        <div>
          <div className="flex items-start justify-between">
            <p className="font-medium text-text group-hover:text-primary transition-colors">{title}</p>
            <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded-full shrink-0 ml-2">
              {TYPE_LABELS[type] || type}
            </span>
          </div>
          {creator && <p className="text-sm text-text-muted">{creator}</p>}
          {description && (
            <p className="text-sm text-text-muted mt-1 line-clamp-2">{description}</p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">{totalCopies} copias</span>
          <Button
            size="sm"
            onClick={(e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onRequestLoan(); }}
            loading={requesting}
          >
            Solicitar préstamo
          </Button>
        </div>
      </Card>
    </Link>
  );
}
