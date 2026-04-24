"use client";

/**
 * Vista global de recompensas (admin). Tabla cross-subject con filtros por
 * asignatura y profesor. La columna asignatura es clickable para drill-down.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { RewardCategory } from "@prisma/client";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CategoryFilter } from "@/components/ui/CategoryFilter";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { RewardCategoryIcon, getCategoryLabel } from "@/components/shared/RewardCategoryIcon";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/Table";

interface Reward {
  id: string;
  name: string;
  description: string | null;
  badgeCost: number;
  supply: number;
  active: boolean;
  category: RewardCategory;
  subjectBadge: {
    subjectOfferingId: string;
    subjectOffering: {
      group: string;
      academicYear: string;
      subject: { name: string; code: string };
      professor: { id: string; name: string };
    };
  };
  _count: { redemptions: number };
}

interface Offering {
  id: string;
  group: string;
  subject: { code: string };
}

interface Professor {
  id: string;
  name: string;
}

export default function AdminRewardsGlobalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectParam = searchParams.get("subject");
  const professorParam = searchParams.get("professor");

  const { addToast } = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (subjectParam) params.set("subject", subjectParam);
      if (professorParam) params.set("professor", professorParam);
      const qs = params.toString();

      const [rewardsRes, offsRes, profsRes] = await Promise.all([
        fetch(`/api/badges/rewards${qs ? `?${qs}` : ""}`),
        fetch("/api/badges/subject-offerings"),
        fetch("/api/badges/professors"),
      ]);
      if (rewardsRes.ok) setRewards(await rewardsRes.json());
      if (offsRes.ok) setOfferings(await offsRes.json());
      if (profsRes.ok) setProfessors(await profsRes.json());
    } catch {
      addToast("Error al cargar recompensas", "danger");
    } finally {
      setLoading(false);
    }
  }, [subjectParam, professorParam, addToast]);

  useEffect(() => { load(); }, [load]);

  const subjectOptions = useMemo(
    () => offerings.map((o) => ({ value: o.id, label: `${o.subject.code} · ${o.group}` })),
    [offerings],
  );
  const professorOptions = useMemo(
    () => professors.map((p) => ({ value: p.id, label: p.name })),
    [professors],
  );

  function updateQuery(next: { subject?: string | null; professor?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(next)) {
      if (val === undefined) continue;
      if (val === null) params.delete(key);
      else params.set(key, val);
    }
    const qs = params.toString();
    router.replace(`/admin/rewards${qs ? `?${qs}` : ""}`);
  }

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <BackLink href="/admin" label="Volver al panel" />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text">Recompensas (global)</h1>
          <p className="text-text-muted mt-1">
            Todas las recompensas del sistema. Pincha en una fila para ir a su asignatura.
          </p>
        </div>
        <Link href="/admin/rewards/inventory">
          <Button variant="secondary">Inventario por alumno</Button>
        </Link>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">Asignatura</p>
          <CategoryFilter
            categories={subjectOptions}
            selected={subjectParam}
            onSelect={(val) => updateQuery({ subject: val })}
            showAll
            allLabel="Todas"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">Profesor</p>
          <CategoryFilter
            categories={professorOptions}
            selected={professorParam}
            onSelect={(val) => updateQuery({ professor: val })}
            showAll
            allLabel="Todos"
          />
        </div>
      </div>

      {rewards.length === 0 ? (
        <EmptyState
          title="Sin recompensas"
          description={subjectParam || professorParam
            ? "No hay recompensas que coincidan con los filtros."
            : "Aún no hay recompensas en el sistema."}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recompensa</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Asignatura</TableHead>
                <TableHead>Profesor</TableHead>
                <TableHead>Coste</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Canjes</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rewards.map((reward) => {
                const offering = reward.subjectBadge.subjectOffering;
                const target = `/admin/subjects/${reward.subjectBadge.subjectOfferingId}/rewards`;
                return (
                  <TableRow
                    key={reward.id}
                    className="cursor-pointer"
                    onClick={() => router.push(target)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <RewardCategoryIcon category={reward.category} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-text">{reward.name}</p>
                          {reward.description && (
                            <p className="text-xs text-text-muted truncate">{reward.description}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-text-muted">
                      {getCategoryLabel(reward.category)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="text-text">{offering.subject.name}</p>
                        <p className="text-xs text-text-muted">
                          {offering.subject.code} · {offering.group}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-text-muted text-sm">
                      {offering.professor.name}
                    </TableCell>
                    <TableCell>{reward.badgeCost}</TableCell>
                    <TableCell>{reward.supply === 0 ? "Ilimitado" : reward.supply}</TableCell>
                    <TableCell>{reward._count.redemptions}</TableCell>
                    <TableCell>
                      <Badge variant={reward.active ? "success" : "neutral"}>
                        {reward.active ? "Activa" : "Desactivada"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
