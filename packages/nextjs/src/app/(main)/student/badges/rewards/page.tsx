"use client";

/**
 * Recompensas del alumno.
 *
 * - Sin `?subject=...` → vista global: todas las recompensas que el alumno
 *   puede canjear y todas las que ya canjeó (de todas sus asignaturas), con
 *   filtro opcional. No muestra el desglose de insignias (eso es por
 *   asignatura concreta).
 * - Con `?subject=<offeringId>` → vista por asignatura: añade el desglose
 *   superior con las insignias del alumno en ese grupo.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { RewardCategory } from "@prisma/client";
import { useToast } from "@/hooks/useToast";
import { toastRewards } from "@/lib/rewardToast";
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
  totalBadges?: number;
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
  subjectBadge: {
    id: string;
    subjectOffering?: {
      id: string;
      group: string;
      academicYear: string;
      subject: { name: string; code: string };
    };
  };
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
  subjectName?: string;
  subjectCode?: string;
  group?: string;
  subjectOfferingId?: string;
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const subjectQs = subjectParam ? `?subject=${subjectParam}` : "";
      const fetches: Promise<Response>[] = [
        fetch("/api/badges/my/subjects"),
        fetch(`/api/badges/rewards/available${subjectQs}`),
        fetch(`/api/badges/my/rewards${subjectQs}`),
      ];
      // El breakdown solo aplica con asignatura concreta.
      if (subjectParam) {
        fetches.push(fetch(`/api/badges/my/subjects/${subjectParam}/breakdown`));
      }

      const results = await Promise.all(fetches);
      const [subjectsRes, rewardsRes, myRewardsRes, breakdownRes] = results;

      if (subjectsRes.ok) setSubjects(await subjectsRes.json());
      if (rewardsRes.ok) setRewards(await rewardsRes.json());
      if (myRewardsRes.ok) setMyRewards(await myRewardsRes.json());
      if (subjectParam && breakdownRes && breakdownRes.ok) {
        setBreakdown(await breakdownRes.json());
      } else {
        setBreakdown(null);
      }
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
    if (offeringId) {
      router.replace(`/student/badges/rewards?subject=${offeringId}`);
    } else {
      router.replace("/student/badges/rewards");
    }
  }

  async function handleRedeem(rewardId: string) {
    setRedeemingId(rewardId);
    try {
      const res = await fetch(`/api/badges/rewards/${rewardId}/redeem`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      addToast("Recompensa canjeada", "success");
      toastRewards(addToast, data.rewards);
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

  if (loading) return <SkeletonPage />;

  const currentSubject = subjectParam
    ? subjects.find((s) => s.subjectOfferingId === subjectParam) ?? null
    : null;

  return (
    <div className="space-y-6">
      <BackLink href="/student/badges" label="Volver a insignias" />

      <div>
        <h1 className="text-2xl font-bold text-text">Mis recompensas</h1>
        {currentSubject ? (
          <p className="text-text-muted mt-1">
            {currentSubject.subjectName} · {currentSubject.subjectCode} · {currentSubject.group} · {currentSubject.academicYear}
          </p>
        ) : (
          <p className="text-text-muted mt-1">
            Recompensas de todas tus asignaturas. Filtra para ver una concreta.
          </p>
        )}
      </div>

      {subjects.length > 1 && (
        <CategoryFilter
          categories={subjectOptions}
          selected={subjectParam}
          onSelect={handleSubjectChange}
          showAll
          allLabel="Todas"
        />
      )}

      {/* Card superior con desglose: solo cuando hay asignatura concreta */}
      {breakdown && (
        <SubjectBadgesBreakdownCard
          totalBadges={breakdown.totalBadges}
          earnedBadges={breakdown.earnedBadges}
          burnedBadges={breakdown.burnedBadges}
          breakdown={breakdown.breakdown}
          previewCount={BREAKDOWN_PREVIEW}
        />
      )}

      {/* Disponibles — solo en vista por asignatura concreta. La vista global
          se centra en lo que ya has canjeado para que puedas solicitar uso. */}
      {currentSubject && (
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
      )}

      {/* Mis recompensas canjeadas */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon={icons.history}>Recompensas canjeadas</SectionTitle>
          <Link
            href={
              subjectParam
                ? `/student/badges/requests?subject=${subjectParam}`
                : "/student/badges/requests"
            }
          >
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
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                subjectName={
                  !currentSubject && mr.subjectCode && mr.group
                    ? `${mr.subjectCode} · ${mr.group}`
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
