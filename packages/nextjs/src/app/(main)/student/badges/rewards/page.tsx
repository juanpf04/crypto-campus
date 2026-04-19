"use client";

/**
 * Catálogo de recompensas canjeables + historial de canjes del alumno.
 * Las insignias son por asignatura, así que el balance se calcula por subjectBadgeId.
 */

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { SkeletonPage } from "@/components/ui/Skeleton";
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
  subjectBadge: {
    id: string;
    subjectOffering: { subject: { name: string; code: string }; group: string };
  };
  _count: { redemptions: number };
}

interface BadgeBySubject {
  subjectBadgeId: string;
  totalBadges: number;
}

interface Redemption {
  id: string;
  redeemedAt: string;
  reward: {
    name: string;
    badgeCost: number;
    subjectBadge: { subjectOffering: { subject: { name: string } } };
  };
}

export default function StudentRewardsPage() {
  const { addToast } = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [badgeBalances, setBadgeBalances] = useState<Map<string, number>>(new Map());
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
      if (badgesRes.ok) {
        const groups: BadgeBySubject[] = await badgesRes.json();
        const map = new Map<string, number>();
        for (const g of groups) map.set(g.subjectBadgeId, g.totalBadges);
        setBadgeBalances(map);
      }
      if (redemptionsRes.ok) setRedemptions(await redemptionsRes.json());
    } catch { /* no-op */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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

  if (loading) return <SkeletonPage />;

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
            {rewards.map((r) => {
              const subjectName = `${r.subjectBadge.subjectOffering.subject.code} · ${r.subjectBadge.subjectOffering.group}`;
              return (
                <RewardCard
                  key={r.id}
                  name={r.name}
                  description={r.description}
                  badgeCost={r.badgeCost}
                  supply={r.supply}
                  redemptionCount={r._count.redemptions}
                  subjectName={subjectName}
                  studentBadgeCount={badgeBalances.get(r.subjectBadge.id) || 0}
                  onRedeem={() => handleRedeem(r.id)}
                  redeeming={redeeming === r.id}
                />
              );
            })}
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
                    <p className="text-xs text-text-muted">
                      {r.reward.badgeCost} insignias · {r.reward.subjectBadge.subjectOffering.subject.name}
                    </p>
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
