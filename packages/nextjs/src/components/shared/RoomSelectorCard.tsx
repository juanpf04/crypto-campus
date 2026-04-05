"use client";

/**
 * RoomSelectorCard — Tarjeta seleccionable de sala.
 * Molécula para el grid de selección de salas del estudiante.
 */

interface RoomSelectorCardProps {
  name: string;
  location: string | null;
  capacity: number;
  amenities: Record<string, boolean> | null;
  selected?: boolean;
  onClick: () => void;
}

const amenityLabels: Record<string, string> = {
  projector: "Proyector",
  whiteboard: "Pizarra",
  powerOutlets: "Enchufes",
  airConditioning: "Aire acond.",
};

export function RoomSelectorCard({
  name,
  location,
  capacity,
  amenities,
  selected,
  onClick,
}: RoomSelectorCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition-colors cursor-pointer ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border-default bg-card hover:border-primary/50"
      }`}
    >
      <p className="font-medium text-text">{name}</p>
      {location && <p className="text-xs text-text-muted">{location}</p>}
      <p className="text-xs text-text-muted mt-1">{capacity} personas</p>
      {amenities && Object.keys(amenities).length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {Object.entries(amenities).map(
            ([key, val]) =>
              val && (
                <span
                  key={key}
                  className="text-[10px] bg-surface px-1.5 py-0.5 rounded text-text-muted"
                >
                  {amenityLabels[key] || key}
                </span>
              ),
          )}
        </div>
      )}
    </button>
  );
}
