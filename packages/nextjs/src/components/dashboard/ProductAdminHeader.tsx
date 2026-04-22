"use client";

/**
 * ProductAdminHeader — Cabecera de la vista admin de detalle de producto.
 *
 * Muestra badges (categoría, activo, variantes activas), nombre, descripción,
 * precio y botones de acción a nivel de grupo (editar / desactivar-reactivar).
 */

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface ProductAdminHeaderProps {
  groupKey: string;
  name: string;
  description: string | null;
  category: string | null;
  active: boolean;
  totalStock: number;
  minPrice: number;
  maxPrice: number;
  activeVariantsCount: number;
  totalVariants: number;
  toggling: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
}

export function ProductAdminHeader({
  name,
  description,
  category,
  active,
  totalStock,
  minPrice,
  maxPrice,
  activeVariantsCount,
  totalVariants,
  toggling,
  onEdit,
  onToggleActive,
}: ProductAdminHeaderProps) {
  const priceLabel = minPrice === maxPrice
    ? `${minPrice} ShopTokens`
    : `${minPrice} - ${maxPrice} ShopTokens`;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {category && <Badge variant="neutral">{category}</Badge>}
          <Badge variant={active ? "success" : "danger"}>
            {active ? "Activo" : "Inactivo"}
          </Badge>
          <Badge variant="info">
            {activeVariantsCount}/{totalVariants} variantes activas
          </Badge>
        </div>

        <h1 className="text-2xl font-bold text-text">{name}</h1>

        {description && (
          <p className="text-text-muted mt-2 leading-relaxed">{description}</p>
        )}
      </div>

      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-primary">{priceLabel}</span>
        <span className="text-sm text-text-muted">· {totalStock} uds. en stock</span>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onEdit}>
          Editar grupo
        </Button>
        <Button
          variant={active ? "danger" : "success"}
          className="flex-1"
          onClick={onToggleActive}
          loading={toggling}
        >
          {active ? "Desactivar grupo" : "Reactivar grupo"}
        </Button>
      </div>
    </div>
  );
}
