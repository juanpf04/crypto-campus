"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { ItemForm, type ItemFormData } from "@/components/forms/ItemForm";

export default function LibrarianNewItemPage() {
  const router = useRouter();
  const { addToast } = useToast();

  async function handleSubmit(data: ItemFormData) {
    const metadata: Record<string, unknown> = {};

    if (data.type === "BOOK") {
      if (data.isbn) metadata.isbn = data.isbn;
      if (data.publisher) metadata.publisher = data.publisher;
      if (data.year) metadata.year = parseInt(data.year);
      if (data.pages) metadata.pages = parseInt(data.pages);
    } else if (data.type === "BOARD_GAME") {
      if (data.players) metadata.players = data.players;
      if (data.duration) metadata.duration = data.duration;
      if (data.ageRating) metadata.ageRating = data.ageRating;
    } else if (data.type === "VIDEO_GAME") {
      if (data.platform) metadata.platform = data.platform;
      if (data.genre) metadata.genre = data.genre;
    }

    const res = await fetch("/api/library/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.title,
        type: data.type,
        creator: data.creator || undefined,
        description: data.description || undefined,
        category: data.category || undefined,
        physicalLocation: data.physicalLocation || undefined,
        physicalCondition: data.physicalCondition || undefined,
        copies: parseInt(data.totalCopies),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Error al crear ítem");
    }

    addToast("Ítem creado correctamente", "success");
    router.push("/dashboard/librarian/items");
  }

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/librarian/items" label="Volver al catálogo" />
      <h1 className="text-2xl font-bold text-text">Añadir ítem</h1>
      <Card className="max-w-2xl mx-auto p-6">
        <ItemForm onSubmit={handleSubmit} />
      </Card>
    </div>
  );
}
