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
  // Badge "X/Y disponibles": informa de un vistazo si quedan copias.
  // Verde con copias, rojo si no quedan.
  const hasAvailable = availableCopies === undefined || availableCopies > 0;

  return (
    <Link href={`${detailBase}/${id}`} className="block group">
      <Card className="relative h-full flex flex-col overflow-hidden p-0 transition-colors group-hover:border-primary/50">
        {/* Cabecera visual */}
        <div className="relative flex h-40 items-center justify-center bg-primary/5 shrink-0">
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

          {/* Badge de disponibilidad arriba a la derecha */}
          <div className="absolute top-2 right-2">
            <Badge variant={hasAvailable ? "success" : "danger"}>
              {availableCopies !== undefined
                ? `${availableCopies}/${totalCopies} disponibles`
                : `${totalCopies} copias`}
            </Badge>
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col flex-1 space-y-2 p-4">
          <Badge variant="neutral">
            <span aria-hidden="true">{TYPE_EMOJI[type] || "\u{1F4E6}"}</span>{" "}
            {TYPE_LABELS[type] || type}
          </Badge>

          <h3 className="font-semibold text-text line-clamp-2 leading-tight group-hover:text-primary transition-colors">
            {title}
          </h3>

          {creator && (
            <p className="text-sm text-text-muted">{creator}</p>
          )}

          {description && (
            <p className="text-sm text-text-muted line-clamp-2">{description}</p>
          )}

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
      </Card>
    </Link>
  );
}
