"use client";

/**
 * Catálogo de recompensas canjeables + historial de canjes del estudiante.
 */

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { RewardCard } from "@/components/shared/RewardCard";
import { Card } from "@/components/ui/Card";
import { icons } from "@/components/ui/icons";

interface Reward {
  id: string;
  name: string;
  description: string | null;
  badgeCost: number;
  supply: number;
  badgeType: { id: string; name: string; tokenId: number };
  _count: { redemptions: number };
}

interface BadgeAward {
  badgeType: { id: string };
}

interface Redemption {
  id: string;
  redeemedAt: string;
  reward: { name: string; badgeCost: number; badgeType: { name: string } };
}

export default function StudentRewardsPage() {
  const { addToast } = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [badges, setBadges] = useState<BadgeAward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [rewardsRes, badgesRes, redemptionsRes] = await Promise.all([
        fetch("/api/badges/rewards/available"),
        fetch("/api/badges/my/badges"),
        fetch("/api/badges/my/redemptions"),
      ]);
      if (rewardsRes.ok) setRewards(await rewardsRes.json());
      if (badgesRes.ok) setBadges(await badgesRes.json());
      if (redemptionsRes.ok) setRedemptions(await redemptionsRes.json());
    } catch { /* no-op */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Contar badges por tipo
  const badgeCountByType = new Map<string, number>();
  for (const b of badges) {
    badgeCountByType.set(b.badgeType.id, (badgeCountByType.get(b.badgeType.id) || 0) + 1);
  }

  async function handleRedeem(rewardId: string) {
    setRedeeming(rewardId);
    try {
      const res = await fetch(`/api/badges/rewards/${rewardId}/redeem`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast("Recompensa canjeada correctamente", "success");
      loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al canjear", "danger");
    } finally {
      setRedeeming(null);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-8">
      <BackLink href="/student/badges" label="Volver a insignias" />
      <h1 className="text-2xl font-bold text-text">Recompensas</h1>

      <section className="space-y-4">
        <SectionTitle icon={icons.reward}>Disponibles</SectionTitle>
        {rewards.length === 0 ? (
          <EmptyState title="Sin recompensas" description="No hay recompensas disponibles actualmente." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rewards.map((r) => (
              <RewardCard
                key={r.id}
                name={r.name}
                description={r.description}
                badgeCost={r.badgeCost}
                supply={r.supply}
                redemptionCount={r._count.redemptions}
                badgeTypeName={r.badgeType.name}
                studentBadgeCount={badgeCountByType.get(r.badgeType.id) || 0}
                onRedeem={() => handleRedeem(r.id)}
                redeeming={redeeming === r.id}
              />
            ))}
          </div>
        )}
      </section>

      {redemptions.length > 0 && (
        <section className="space-y-4">
          <SectionTitle icon={icons.history}>Mis canjes</SectionTitle>
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-border-default">
              {redemptions.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-text">{r.reward.name}</p>
                    <p className="text-xs text-text-muted">{r.reward.badgeCost} {r.reward.badgeType.name}</p>
                  </div>
                  <span className="text-xs text-text-muted">
                    {new Date(r.redeemedAt).toLocaleDateString("es-ES")}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
