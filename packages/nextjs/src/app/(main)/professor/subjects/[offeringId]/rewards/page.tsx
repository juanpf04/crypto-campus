"use client";

/**
 * Recompensas de UNA asignatura impartida por el profesor.
 * Lista + acciones (desactivar). El botón "Mis solicitudes" de esa
 * asignatura está en el sidebar (subsección); aquí no lo repetimos.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { RewardCategory } from "@prisma/client";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
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
  _count: { redemptions: number };
}

interface OfferingInfo {
  id: string;
  subjectName: string;
  subjectCode: string;
  group: string;
  academicYear: string;
}

export default function ProfessorOfferingRewardsPage() {
  const params = useParams<{ offeringId: string }>();
  const offeringId = params.offeringId;
  const { addToast } = useToast();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [offering, setOffering] = useState<OfferingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Reward | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rewardsRes, summaryRes] = await Promise.all([
        fetch(`/api/badges/rewards?subject=${offeringId}`),
        fetch(`/api/badges/offerings/${offeringId}/summary`),
      ]);
      if (rewardsRes.ok) setRewards(await rewardsRes.json());
      if (summaryRes.ok) {
        const body = await summaryRes.json();
        setOffering(body.offering);
      }
    } catch {
      addToast("Error al cargar recompensas", "danger");
    } finally {
      setLoading(false);
    }
  }, [offeringId, addToast]);

  useEffect(() => { load(); }, [load]);

  async function handleDeactivate() {
    if (!confirmTarget) return;
    setDeactivating(confirmTarget.id);
    try {
      const res = await fetch(`/api/badges/rewards/${confirmTarget.id}/deactivate`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error al desactivar");
      }
      addToast("Recompensa desactivada", "success");
      setConfirmTarget(null);
      load();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "danger");
    } finally {
      setDeactivating(null);
    }
  }

  if (loading) return <SkeletonPage />;

  const base = `/professor/subjects/${offeringId}`;

  return (
    <div className="space-y-6">
      <BackLink href={base} label="Volver al resumen" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Recompensas</h1>
          {offering && (
            <p className="text-text-muted mt-1">
              {offering.subjectName} · {offering.subjectCode} · {offering.group} · {offering.academicYear}
            </p>
          )}
        </div>
        <Link href={`${base}/rewards/new`}>
          <Button>+ Nueva recompensa</Button>
        </Link>
      </div>

      {rewards.length === 0 ? (
        <EmptyState
          title="Sin recompensas"
          description="Aún no has creado ninguna recompensa en esta asignatura. Crea una para que los alumnos puedan canjear sus insignias."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recompensa</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Coste</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Canjes</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rewards.map((reward) => (
                <TableRow key={reward.id}>
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
                  <TableCell>{reward.badgeCost} insignia{reward.badgeCost !== 1 ? "s" : ""}</TableCell>
                  <TableCell>{reward.supply === 0 ? "Ilimitado" : reward.supply}</TableCell>
                  <TableCell>{reward._count.redemptions}</TableCell>
                  <TableCell>
                    <Badge variant={reward.active ? "success" : "neutral"}>
                      {reward.active ? "Activa" : "Desactivada"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {reward.active && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setConfirmTarget(reward)}
                        loading={deactivating === reward.id}
                      >
                        Desactivar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ConfirmModal
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleDeactivate}
        title="Desactivar recompensa"
        description={
          confirmTarget
            ? `"${confirmTarget.name}" dejará de estar disponible para canjear. Los alumnos que ya la hayan canjeado mantendrán su token.`
            : ""
        }
        confirmLabel="Desactivar"
        loading={deactivating !== null}
      />
    </div>
  );
}
