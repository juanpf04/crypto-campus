"use client";

/**
 * LibraryItemCard — Tarjeta de ítem de biblioteca para el catálogo del estudiante.
 * Muestra cabecera visual con emoji/cover, badge de tipo, título, autor,
 * descripción, copias y botón de solicitud alineado al fondo.
 */

import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LinkArrow } from "@/components/shared/LinkArrow";
import { TYPE_LABELS, TYPE_EMOJI } from "@/lib/library-constants";

interface LibraryItemCardProps {
  id: string;
  title: string;
  type: string;
  creator: string | null;
  description: string | null;
  coverUrl?: string | null;
  totalCopies: number;
  availableCopies?: number;
  onRequestLoan: () => void;
  requesting?: boolean;
  /** Si false, el botón se deshabilita y se muestra texto explicativo. */
  hasTokens?: boolean;
  /** Base URL para el detalle (por defecto /student/library) */
  detailBase?: string;
}

export function LibraryItemCard({
  id,
  title,
  type,
  creator,
  description,
  coverUrl,
  totalCopies,
  availableCopies,
  onRequestLoan,
  requesting,
  hasTokens = true,
  detailBase = "/student/library",
}: LibraryItemCardProps) {
  return (
    <Link href={`${detailBase}/${id}`} className="block group">
      <Card className="relative h-full flex flex-col overflow-hidden p-0 transition-colors group-hover:border-primary/50">
        {/* Cabecera visual */}
        <div className="flex h-40 items-center justify-center bg-primary/5 shrink-0">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={title}
              width={640}
              height={320}
              unoptimized
              className="h-full w-full object-contain p-4"
            />
          ) : (
            <span className="text-5xl" role="img" aria-label={TYPE_LABELS[type] || type}>
              {TYPE_EMOJI[type] || "\u{1F4E6}"}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col flex-1 space-y-2 p-4">
          <Badge variant="neutral">{TYPE_LABELS[type] || type}</Badge>

          <h3 className="font-semibold text-text line-clamp-2 leading-tight group-hover:text-primary transition-colors">
            {title}
          </h3>

          {creator && (
            <p className="text-sm text-text-muted">{creator}</p>
          )}

          {description && (
            <p className="text-sm text-text-muted line-clamp-2">{description}</p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">{totalCopies} copias</span>
            {availableCopies !== undefined && (
              <span className="text-xs text-text-muted">{availableCopies} disponibles</span>
            )}
          </div>

          {/* Botón alineado al fondo */}
          <Button
            size="sm"
            className="mt-auto w-full"
            onClick={(e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onRequestLoan(); }}
            loading={requesting}
            disabled={!hasTokens}
            title={!hasTokens ? "Necesitas Tokens de Préstamo para solicitar" : undefined}
          >
            {hasTokens ? "Solicitar préstamo" : "Sin tokens disponibles"}
          </Button>
        </div>

        <LinkArrow variant="fade" size="sm" className="right-3 top-3" />
      </Card>
    </Link>
  );
}
