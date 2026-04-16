"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { RoomForm, type RoomFormData } from "@/components/forms/RoomForm";

export default function AdminEditRoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const [initialValues, setInitialValues] = useState<Partial<RoomFormData> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/rooms/${id}`);
        if (!res.ok) throw new Error();
        const room = await res.json();
        const amenities = room.amenities as Record<string, boolean> || {};
        setInitialValues({
          name: room.name, description: room.description || "", location: room.location || "",
          capacity: String(room.capacity),
          amenityProjector: !!amenities.projector, amenityWhiteboard: !!amenities.whiteboard,
          amenityAirConditioning: !!amenities.airConditioning, amenityPowerOutlets: !!amenities.powerOutlets,
        });
      } catch { addToast("Error", "danger"); router.push("/admin/library/rooms"); }
      finally { setLoading(false); }
    }
    load();
  }, [id, addToast, router]);

  async function handleSubmit(data: RoomFormData) {
    const amenities: Record<string, boolean> = {};
    if (data.amenityProjector) amenities.projector = true;
    if (data.amenityWhiteboard) amenities.whiteboard = true;
    if (data.amenityAirConditioning) amenities.airConditioning = true;
    if (data.amenityPowerOutlets) amenities.powerOutlets = true;

    const res = await fetch(`/api/rooms/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name, description: data.description || undefined,
        location: data.location || undefined, capacity: parseInt(data.capacity),
        amenities: Object.keys(amenities).length > 0 ? amenities : undefined,
      }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Error"); }
    addToast("Sala actualizada", "success");
    router.push("/admin/library/rooms");
  }

  if (loading || !initialValues) return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/library/rooms" label="Volver a salas" />
      <h1 className="text-2xl font-bold text-text">Editar sala</h1>
      <Card className="max-w-2xl mx-auto p-6"><RoomForm onSubmit={handleSubmit} initialValues={initialValues} isEdit /></Card>
    </div>
  );
}
