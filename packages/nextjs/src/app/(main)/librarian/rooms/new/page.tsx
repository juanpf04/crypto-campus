"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { RoomForm, type RoomFormData } from "@/components/forms/RoomForm";

export default function LibrarianNewRoomPage() {
  const router = useRouter();
  const { addToast } = useToast();

  async function handleSubmit(data: RoomFormData) {
    const amenities: Record<string, boolean> = {};
    if (data.amenityProjector) amenities.projector = true;
    if (data.amenityWhiteboard) amenities.whiteboard = true;
    if (data.amenityAirConditioning) amenities.airConditioning = true;
    if (data.amenityPowerOutlets) amenities.powerOutlets = true;

    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        description: data.description || undefined,
        location: data.location || undefined,
        capacity: parseInt(data.capacity),
        amenities: Object.keys(amenities).length > 0 ? amenities : undefined,
        imageUrl: data.imageUrl || undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Error al crear sala");
    }

    addToast("Sala creada correctamente", "success");
    router.push("/librarian/rooms");
  }

  return (
    <div className="space-y-6">
      <BackLink href="/librarian/rooms" label="Volver a salas" />
      <h1 className="text-2xl font-bold text-text">Crear sala</h1>
      <Card className="max-w-2xl mx-auto p-6">
        <RoomForm onSubmit={handleSubmit} />
      </Card>
    </div>
  );
}
