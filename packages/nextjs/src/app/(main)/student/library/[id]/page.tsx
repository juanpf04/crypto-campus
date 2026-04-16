"use client";

/**
 * Detalle de un ítem de la biblioteca (estudiante).
 * Muestra información completa + metadata específica por tipo + botón de préstamo.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { DetailField } from "@/components/shared/DetailField";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { icons } from "@/components/ui/icons";
import { TYPE_LABELS } from "@/lib/library-constants";

interface ItemDetail {
  id: string;
  tokenId: number;
  type: string;
  title: string;
  creator: string | null;
  description: string | null;
  category: string | null;
  coverUrl: string | null;
  physicalLocation: string | null;
  physicalCondition: string;
  totalCopies: number;
  availableCopies: number;
  metadata: Record<string, unknown> | null;
}

export default function StudentItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/library/items/${id}`);
        if (!res.ok) throw new Error();
        setItem(await res.json());
      } catch {
        addToast("Error al cargar el ítem", "danger");
        router.push("/student/library");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, addToast, router]);

  async function handleRequestLoan() {
    if (!item) return;
    setRequesting(true);
    try {
      const res = await fetch("/api/library/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast("Préstamo solicitado correctamente", "success");
      router.push("/student/library");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al solicitar préstamo", "danger");
    } finally {
      setRequesting(false);
    }
  }

  if (loading || !item) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  const meta = item.metadata || {};

  return (
    <div className="space-y-6">
      <BackLink href="/student/library" label="Volver a biblioteca" />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{item.title}</h1>
          {item.creator && <p className="text-text-muted mt-1">{item.creator}</p>}
        </div>
        <Badge variant="info">{TYPE_LABELS[item.type] || item.type}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {item.description && (
            <Card className="p-5">
              <p className="text-sm text-text leading-relaxed">{item.description}</p>
            </Card>
          )}

          {/* Metadata específica por tipo */}
          {item.type === "BOOK" && Object.keys(meta).length > 0 && (
            <Card className="p-5 space-y-4">
              <SectionTitle icon={icons.library}>Datos del libro</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                {meta.isbn ? <DetailField label="ISBN" value={String(meta.isbn)} /> : null}
                {meta.publisher ? <DetailField label="Editorial" value={String(meta.publisher)} /> : null}
                {meta.year ? <DetailField label="Año" value={String(meta.year)} /> : null}
                {meta.pages ? <DetailField label="Páginas" value={String(meta.pages)} /> : null}
              </div>
            </Card>
          )}

          {item.type === "BOARD_GAME" && Object.keys(meta).length > 0 && (
            <Card className="p-5 space-y-4">
              <SectionTitle icon={icons.items}>Datos del juego</SectionTitle>
              <div className="grid grid-cols-3 gap-4">
                {meta.players ? <DetailField label="Jugadores" value={String(meta.players)} /> : null}
                {meta.duration ? <DetailField label="Duración" value={String(meta.duration)} /> : null}
                {meta.ageRating ? <DetailField label="Edad mínima" value={String(meta.ageRating)} /> : null}
              </div>
            </Card>
          )}

          {item.type === "VIDEO_GAME" && Object.keys(meta).length > 0 && (
            <Card className="p-5 space-y-4">
              <SectionTitle icon={icons.items}>Datos del videojuego</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                {meta.platform ? <DetailField label="Plataforma" value={String(meta.platform)} /> : null}
                {meta.genre ? <DetailField label="Género" value={String(meta.genre)} /> : null}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar derecho */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Disponibles</span>
              <Badge variant={item.availableCopies > 0 ? "success" : "danger"}>
                {item.availableCopies} / {item.totalCopies}
              </Badge>
            </div>

            {item.category && <DetailField label="Categoría" value={item.category} />}
            {item.physicalLocation && <DetailField label="Ubicación" value={item.physicalLocation} />}
            <DetailField label="Estado físico" value={item.physicalCondition} />

            <Button
              className="w-full"
              onClick={handleRequestLoan}
              loading={requesting}
            >
              {item.availableCopies > 0 ? "Reservar" : "Unirse a la cola"}
            </Button>

            <p className="text-xs text-text-muted text-center">
              {item.availableCopies > 0
                ? "Se reservará una copia (recogida en 3 días)"
                : "Entrarás en la lista de espera"}
              {" · "}1 LibraryToken como depósito
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
