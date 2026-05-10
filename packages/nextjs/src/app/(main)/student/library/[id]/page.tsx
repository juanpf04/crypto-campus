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
import { SkeletonPage } from "@/components/ui/Skeleton";
import { DetailField } from "@/components/shared/DetailField";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { icons } from "@/components/ui/icons";
import { TYPE_LABELS, TYPE_EMOJI } from "@/lib/library-constants";

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
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [itemRes, balanceData] = await Promise.all([
          fetch(`/api/library/items/${id}`),
          fetch("/api/library/balance").then((r) => r.json()).catch(() => ({ balance: 0 })),
        ]);
        if (!itemRes.ok) throw new Error();
        setItem(await itemRes.json());
        setBalance(balanceData.balance ?? 0);
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
    // Pre-flight: cada préstamo requiere 1 Token como depósito.
    if ((balance ?? 0) < 1) {
      addToast("Necesitas al menos 1 Token de Préstamo para solicitar. Pide al admin que te asigne tokens.", "danger");
      return;
    }
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

  if (loading || !item) return <SkeletonPage />;

  const meta = item.metadata || {};

  return (
    <div className="space-y-6">
      <BackLink href="/student/library" label="Volver a biblioteca" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {/* Icono grande según tipo */}
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-4xl"
            role="img"
            aria-label={TYPE_LABELS[item.type] || item.type}
          >
            {TYPE_EMOJI[item.type] || "\u{1F4E6}"}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-text break-words">{item.title}</h1>
            {item.creator && <p className="text-text-muted mt-1">{item.creator}</p>}
          </div>
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

          {/* Metadata específica por tipo: muestra todos los campos posibles
              aunque estén vacíos — uniformiza la ficha entre items. */}
          {item.type === "BOOK" && (
            <Card className="p-5 space-y-4">
              <SectionTitle icon={icons.library}>Datos del libro</SectionTitle>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <DetailField label="ISBN" value={meta.isbn ? String(meta.isbn) : "—"} />
                <DetailField label="Editorial" value={meta.publisher ? String(meta.publisher) : "—"} />
                <DetailField label="Año" value={meta.year ? String(meta.year) : "—"} />
                <DetailField label="Páginas" value={meta.pages ? String(meta.pages) : "—"} />
              </div>
            </Card>
          )}

          {item.type === "BOARD_GAME" && (
            <Card className="p-5 space-y-4">
              <SectionTitle icon={icons.items}>Datos del juego</SectionTitle>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <DetailField label="Jugadores" value={meta.players ? String(meta.players) : "—"} />
                <DetailField label="Duración" value={meta.duration ? String(meta.duration) : "—"} />
                <DetailField label="Edad mínima" value={meta.ageRating ? String(meta.ageRating) : "—"} />
              </div>
            </Card>
          )}

          {item.type === "VIDEO_GAME" && (
            <Card className="p-5 space-y-4">
              <SectionTitle icon={icons.items}>Datos del videojuego</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <DetailField label="Plataforma" value={meta.platform ? String(meta.platform) : "—"} />
                <DetailField label="Género" value={meta.genre ? String(meta.genre) : "—"} />
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
              disabled={(balance ?? 0) < 1}
              title={(balance ?? 0) < 1 ? "Necesitas Tokens de Préstamo para solicitar" : undefined}
            >
              {(balance ?? 0) < 1
                ? "Sin tokens disponibles"
                : item.availableCopies > 0 ? "Reservar" : "Unirse a la cola"}
            </Button>

            <p className="text-xs text-text-muted text-center">
              {(balance ?? 0) < 1
                ? `Necesitas al menos 1 Token de Préstamo. Tienes ${balance ?? 0}.`
                : (
                  <>
                    {item.availableCopies > 0
                      ? "Se reservará una copia (recogida en 3 días)"
                      : "Entrarás en la lista de espera"}
                    {" · "}1 Token de Préstamo como depósito
                  </>
                )}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
