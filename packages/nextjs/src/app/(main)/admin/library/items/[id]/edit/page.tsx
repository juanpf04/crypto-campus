"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { ItemForm, type ItemFormData } from "@/components/forms/ItemForm";

export default function AdminEditItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const [initialValues, setInitialValues] = useState<Partial<ItemFormData> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/library/items/${id}`);
        if (!res.ok) throw new Error();
        const item = await res.json();
        const meta = item.metadata as Record<string, unknown> || {};
        setInitialValues({
          title: item.title, type: item.type, creator: item.creator || "",
          description: item.description || "", category: item.category || "",
          physicalLocation: item.physicalLocation || "", physicalCondition: item.physicalCondition || "Bueno",
          totalCopies: String(item.totalCopies),
          isbn: String(meta.isbn || ""), publisher: String(meta.publisher || ""),
          year: meta.year ? String(meta.year) : "", pages: meta.pages ? String(meta.pages) : "",
          players: String(meta.players || ""), duration: String(meta.duration || ""),
          ageRating: String(meta.ageRating || ""), platform: String(meta.platform || ""),
          genre: String(meta.genre || ""),
        });
      } catch { addToast("Error al cargar ítem", "danger"); router.push("/admin/library/items"); }
      finally { setLoading(false); }
    }
    load();
  }, [id, addToast, router]);

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

    const res = await fetch(`/api/library/items/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.title, type: data.type, creator: data.creator || undefined,
        description: data.description || undefined, category: data.category || undefined,
        physicalLocation: data.physicalLocation || undefined,
        physicalCondition: data.physicalCondition || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Error"); }
    addToast("Ítem actualizado", "success");
    router.push("/admin/library/items");
  }

  if (loading || !initialValues) return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/library/items" label="Volver al catálogo" />
      <h1 className="text-2xl font-bold text-text">Editar ítem</h1>
      <Card className="max-w-2xl mx-auto p-6"><ItemForm onSubmit={handleSubmit} initialValues={initialValues} isEdit /></Card>
    </div>
  );
}
