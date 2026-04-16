"use client";

/**
 * Panel de insignias del alumno.
 * Muestra las insignias agrupadas por asignatura + atajos a tareas, recompensas y solicitudes.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { icons } from "@/components/ui/icons";

interface BadgeBySubject {
  subjectBadgeId: string;
  subjectName: string;
  subjectCode: string;
  group: string;
  academicYear: string;
  totalBadges: number;
  awards: Array<{
    id: string;
    awardedAt: string;
    prizeCategory: { name: string; badgeReward: number; assignment: { id: string; name: string } };
  }>;
}

export default function StudentBadgesPage() {
  const [groups, setGroups] = useState<BadgeBySubject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/badges/my/badges");
        if (res.ok && !cancelled) setGroups(await res.json());
      } catch { /* no-op */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const totalBadges = groups.reduce((sum, g) => sum + g.totalBadges, 0);

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-8">
      <BackLink href="/student" label="Volver al panel" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Mis insignias</h1>
          <p className="text-text-muted mt-1">{totalBadges} insignia{totalBadges !== 1 ? "s" : ""} en total</p>
        </div>
        <div className="flex gap-2">
          <Link href="/student/badges/assignments">
            <Button variant="secondary">
              <span className="flex items-center gap-2">{icons.task} Tareas</span>
            </Button>
          </Link>
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
        <SectionTitle icon={icons.badge}>Por asignatura</SectionTitle>
        {groups.length === 0 ? (
          <EmptyState
            title="Sin insignias"
            description="Aún no has ganado ninguna insignia. Completa tareas en tus asignaturas para ganar."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <Card key={g.subjectBadgeId} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-text-muted">{g.subjectCode} · {g.group} · {g.academicYear}</p>
                    <h3 className="font-semibold text-text mt-0.5">{g.subjectName}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{g.totalBadges}</p>
                    <p className="text-xs text-text-muted">insignias</p>
                  </div>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-text-muted hover:text-text">
                    Ver detalle ({g.awards.length} premio{g.awards.length !== 1 ? "s" : ""})
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {g.awards.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-text-muted truncate">
                          {a.prizeCategory.assignment.name} — <span className="text-text">{a.prizeCategory.name}</span>
                        </span>
                        <span className="font-medium text-primary shrink-0">+{a.prizeCategory.badgeReward}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
