"use client";

/**
 * Recompensas de UNA asignatura concreta.
 * Requiere `?subject=<subjectOfferingId>`. Muestra:
 *   - Card superior con desglose de insignias del alumno en esa asignatura
 *   - Sección "Disponibles": catálogo de recompensas canjeables
 *   - Sección "Mis recompensas": canjeadas agregadas con contadores y selector
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { RewardCategory } from "@prisma/client";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { RewardCard } from "@/components/shared/RewardCard";
import { MyRewardCard } from "@/components/shared/MyRewardCard";
import { SubjectBadgesBreakdownCard } from "@/components/shared/SubjectBadgesBreakdownCard";
import { icons } from "@/components/ui/icons";

interface EnrolledSubject {
  subjectOfferingId: string;
  subjectName: string;
  subjectCode: string;
  group: string;
  academicYear: string;
}

interface PrizeEntry {
  prizeCategoryId: string;
  prizeName: string;
  badgeReward: number;
  timesWon: number;
  totalBadges: number;
}

interface BreakdownEntry {
  assignmentId: string;
  assignmentName: string;
  totalBadges: number;
  prizes: PrizeEntry[];
}

interface SubjectBreakdown {
  subjectOfferingId: string;
  subjectName: string;
  subjectCode: string;
  group: string;
  academicYear: string;
  totalBadges: number;
  earnedBadges: number;
  burnedBadges: number;
  breakdown: BreakdownEntry[];
}

interface Reward {
  id: string;
  name: string;
  description: string | null;
  badgeCost: number;
  supply: number;
  category: RewardCategory;
  subjectBadge: { id: string };
  _count: { redemptions: number };
}

interface MyReward {
  rewardId: string;
  rewardName: string;
  description: string | null;
  category: RewardCategory;
  badgeCost: number;
  redemptions: number;
  pending: number;
  approved: number;
  available: number;
}

const BREAKDOWN_PREVIEW = 3;

export default function StudentRewardsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectParam = searchParams.get("subject");

  const { addToast } = useToast();
  const [subjects, setSubjects] = useState<EnrolledSubject[]>([]);
  const [breakdown, setBreakdown] = useState<SubjectBreakdown | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [myRewards, setMyRewards] = useState<MyReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  useEffect(() => {
    if (!subjectParam) {
      router.replace("/student/badges");
    }
  }, [subjectParam, router]);

  const loadData = useCallback(async () => {
    if (!subjectParam) return;
    setLoading(true);
    try {
      const [subjectsRes, breakdownRes, rewardsRes, myRewardsRes] = await Promise.all([
        fetch("/api/badges/my/subjects"),
        fetch(`/api/badges/my/subjects/${subjectParam}/breakdown`),
        fetch(`/api/badges/rewards/available?subject=${subjectParam}`),
        fetch(`/api/badges/my/rewards?subject=${subjectParam}`),
      ]);
      if (subjectsRes.ok) setSubjects(await subjectsRes.json());
      if (breakdownRes.ok) setBreakdown(await breakdownRes.json());
      if (rewardsRes.ok) setRewards(await rewardsRes.json());
      if (myRewardsRes.ok) setMyRewards(await myRewardsRes.json());
    } catch {
      addToast("Error al cargar recompensas", "danger");
    } finally {
      setLoading(false);
    }
  }, [subjectParam, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const subjectOptions = useMemo(
    () =>
      subjects.map((s) => ({
        value: s.subjectOfferingId,
        label: `${s.subjectCode} · ${s.group}`,
      })),
    [subjects],
  );

  function handleSubjectChange(offeringId: string | null) {
    if (!offeringId) return;
    router.replace(`/student/badges/rewards?subject=${offeringId}`);
  }

  async function handleRedeem(rewardId: string) {
    setRedeemingId(rewardId);
    try {
      const res = await fetch(`/api/badges/rewards/${rewardId}/redeem`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast("Recompensa canjeada", "success");
      loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al canjear", "danger");
    } finally {
      setRedeemingId(null);
    }
  }

  async function handleRequestUse(rewardId: string, quantity: number) {
    setRequestingId(rewardId);
    try {
      for (let i = 0; i < quantity; i++) {
        const res = await fetch("/api/badges/use-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rewardId }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "Error al solicitar uso");
        }
      }
      addToast(
        quantity === 1 ? "Solicitud enviada" : `${quantity} solicitudes enviadas`,
        "success",
      );
      loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al solicitar uso", "danger");
    } finally {
      setRequestingId(null);
    }
  }

  if (!subjectParam || loading) return <SkeletonPage />;

  const currentSubject = subjects.find((s) => s.subjectOfferingId === subjectParam);

  return (
    <div className="space-y-6">
      <BackLink href="/student/badges" label="Volver a insignias" />

      <div>
        <h1 className="text-2xl font-bold text-text">Recompensas</h1>
        {currentSubject && (
          <p className="text-text-muted mt-1">
            {currentSubject.subjectName} · {currentSubject.subjectCode} · {currentSubject.group} · {currentSubject.academicYear}
          </p>
        )}
      </div>

      {subjects.length > 1 && (
        <CategoryFilter
          categories={subjectOptions}
          selected={subjectParam}
          onSelect={handleSubjectChange}
          showAll={false}
        />
      )}

      {/* Card superior: insignias del alumno en esta asignatura */}
      {breakdown && (
        <SubjectBadgesBreakdownCard
          totalBadges={breakdown.totalBadges}
          earnedBadges={breakdown.earnedBadges}
          burnedBadges={breakdown.burnedBadges}
          breakdown={breakdown.breakdown}
          previewCount={BREAKDOWN_PREVIEW}
        />
      )}

      {/* Disponibles */}
      <section className="space-y-4">
        <SectionTitle icon={icons.reward}>Disponibles</SectionTitle>
        {rewards.length === 0 ? (
          <EmptyState
            title="Sin recompensas"
            description="Tu profesor aún no ha publicado recompensas canjeables en esta asignatura."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rewards.map((r) => (
              <RewardCard
                key={r.id}
                name={r.name}
                description={r.description}
                badgeCost={r.badgeCost}
                supply={r.supply}
                redemptionCount={r._count.redemptions}
                category={r.category}
                studentBadgeCount={breakdown?.totalBadges ?? 0}
                onRedeem={() => handleRedeem(r.id)}
                redeeming={redeemingId === r.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Mis recompensas */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon={icons.history}>Mis recompensas</SectionTitle>
          <Link href={`/student/badges/requests?subject=${subjectParam}`}>
            <Button variant="secondary" size="sm">
              <span className="flex items-center gap-2">
                {icons.pending} Mis solicitudes
              </span>
            </Button>
          </Link>
        </div>

        {myRewards.length === 0 ? (
          <EmptyState
            title="Aún no has canjeado ninguna recompensa"
            description="Cuando canjees insignias por recompensas, aparecerán aquí con su estado."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {myRewards.map((mr) => (
              <MyRewardCard
                key={mr.rewardId}
                rewardId={mr.rewardId}
                name={mr.rewardName}
                description={mr.description}
                category={mr.category}
                available={mr.available}
                pending={mr.pending}
                approved={mr.approved}
                onRequestUse={(q) => handleRequestUse(mr.rewardId, q)}
                processing={requestingId === mr.rewardId}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
