"use client";

/**
 * Panel de insignias del estudiante.
 * Muestra badges ganados agrupados por tipo + enlaces a recompensas y solicitudes.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { BadgeCard } from "@/components/shared/BadgeCard";
import { icons } from "@/components/ui/icons";

interface BadgeAward {
  badgeType: { id: string; name: string };
  task: { name: string; rewardAmount: number };
  awardedAt: string;
}

interface GroupedBadge {
  badgeTypeId: string;
  badgeTypeName: string;
  count: number;
}

export default function StudentBadgesPage() {
  const [badges, setBadges] = useState<BadgeAward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/badges/my/badges");
        if (res.ok && !cancelled) setBadges(await res.json());
      } catch { /* no-op */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Agrupar badges por tipo
  const grouped: GroupedBadge[] = [];
  const map = new Map<string, GroupedBadge>();
  for (const b of badges) {
    const existing = map.get(b.badgeType.id);
    if (existing) {
      existing.count++;
    } else {
      const g = { badgeTypeId: b.badgeType.id, badgeTypeName: b.badgeType.name, count: 1 };
      map.set(b.badgeType.id, g);
      grouped.push(g);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-8">
      <BackLink href="/student" label="Volver al panel" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Insignias</h1>
          <p className="text-text-muted mt-1">{badges.length} insignia{badges.length !== 1 ? "s" : ""} ganada{badges.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/student/badges/rewards">
            <Button variant="secondary">
              <span className="flex items-center gap-2">{icons.reward} Recompensas</span>
            </Button>
          </Link>
          <Link href="/student/badges/requests">
            <Button variant="secondary">
              <span className="flex items-center gap-2">{icons.pending} Solicitudes</span>
            </Button>
          </Link>
        </div>
      </div>

      <section className="space-y-4">
        <SectionTitle icon={icons.badge}>Mis insignias</SectionTitle>
        {grouped.length === 0 ? (
          <EmptyState title="Sin insignias" description="Aún no has ganado ninguna insignia. Completa tareas de tus asignaturas para obtenerlas." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.map((g) => (
              <BadgeCard key={g.badgeTypeId} name={g.badgeTypeName} count={g.count} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
