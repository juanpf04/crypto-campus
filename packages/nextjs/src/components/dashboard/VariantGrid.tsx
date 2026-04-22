"use client";

/**
 * VariantGrid — Grid responsivo de variantes de un producto + botón/card
 * para añadir una nueva variante.
 *
 * Encapsula la lógica de "ocultar AddCard si el número de variantes es
 * múltiplo de las columnas del breakpoint" (para evitar que la card de
 * añadir quede sola en una fila).
 */

import { AddCard } from "@/components/ui/AddCard";
import { Button } from "@/components/ui/Button";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { VariantGridItem } from "@/components/shared/VariantGridItem";
import { icons } from "@/components/ui/icons";

export interface VariantGridItemData {
  id: string;
  name: string;
  color: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  active: boolean;
}

interface VariantGridProps {
  variants: VariantGridItemData[];
  category: string | null;
  selectedVariantId: string;
  toggling: string | null;
  onSelect: (variantId: string) => void;
  onEditVariant: (variantId: string) => void;
  onToggleVariant: (variantId: string, currentActive: boolean) => void;
  onAddVariant: () => void;
}

export function VariantGrid({
  variants,
  category,
  selectedVariantId,
  toggling,
  onSelect,
  onEditVariant,
  onToggleVariant,
  onAddVariant,
}: VariantGridProps) {
  return (
    <section className="space-y-4">
      <SectionTitle icon={icons.shop}>Todas las variantes ({variants.length})</SectionTitle>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {variants.map((v) => (
          <VariantGridItem
            key={v.id}
            id={v.id}
            name={v.name}
            color={v.color}
            price={v.price}
            stock={v.stock}
            imageUrl={v.imageUrl}
            category={category}
            active={v.active}
            selected={v.id === selectedVariantId}
            toggling={toggling === v.id}
            onSelect={() => onSelect(v.id)}
            onEdit={() => onEditVariant(v.id)}
            onToggleActive={() => onToggleVariant(v.id, v.active)}
          />
        ))}

        <AddCard
          label="Añadir variante"
          onClick={onAddVariant}
          className={[
            variants.length % 2 === 0 ? "hidden" : "",
            variants.length % 3 === 0 ? "sm:hidden" : "sm:flex",
            variants.length % 4 === 0 ? "lg:hidden" : "lg:flex",
          ].join(" ")}
        />
      </div>

      <div className={[
        "flex justify-center pt-2",
        variants.length % 2 === 0 ? "" : "hidden",
        variants.length % 3 === 0 ? "sm:flex" : "sm:hidden",
        variants.length % 4 === 0 ? "lg:flex" : "lg:hidden",
      ].join(" ")}>
        <Button variant="outline" onClick={onAddVariant}>
          + Añadir nueva variante
        </Button>
      </div>
    </section>
  );
}
