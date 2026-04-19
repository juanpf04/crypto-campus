"use client";

/**
 * Panel de recompensas del profesor.
 *
 * Muestra estadísticas, la tabla de recompensas creadas
 * y enlace a la gestión de solicitudes de uso.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";

interface Reward {
  id: string;
  name: string;
  badgeCost: number;
  supply: number;
  active: boolean;
  subjectBadge: {
    subjectOffering: { group: string; subject: { name: string; code: string } };
  };
  _count: { redemptions: number };
}

export default function ProfessorRewardsPage() {
  const { addToast } = useToast();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/badges/rewards");
      if (res.ok) setRewards(await res.json());
    } catch {
      addToast("Error al cargar recompensas", "danger");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalRedemptions = rewards.reduce((sum, r) => sum + r._count.redemptions, 0);

  if (loading && rewards.length === 0) return <SkeletonTable columns={6} rows={6} />;

  return (
    <div className="space-y-8">
      <BackLink href="/professor" label="Volver al panel" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Recompensas</h1>
        <div className="flex gap-2">
          <Link href="/professor/rewards/requests">
            <Button variant="secondary" size="sm">
              <span className="flex items-center gap-2">{icons.pending} Solicitudes</span>
            </Button>
          </Link>
          <Link href="/professor/rewards/new">
            <Button size="sm">Crear recompensa</Button>
          </Link>
        </div>
      </div>

      {/* ── Estadísticas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.reward}>Resumen</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Total recompensas"
            value={rewards.length}
            subtitle="Creadas por ti"
            icon={icons.reward}
          />
          <StatCard
            title="Total canjes"
            value={totalRedemptions}
            subtitle="Por alumnos"
            icon={icons.student}
          />
        </div>
      </section>

      {/* ── Tabla de recompensas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Mis recompensas</SectionTitle>
        {rewards.length === 0 ? (
          <EmptyState
            title="Sin recompensas"
            description="Aún no has creado ninguna recompensa. Crea una para que los alumnos puedan canjear sus insignias."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Asignatura</TableHead>
                  <TableHead>Coste (insignias)</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Canjes</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rewards.map((reward) => (
                  <TableRow key={reward.id}>
                    <TableCell className="font-medium">{reward.name}</TableCell>
                    <TableCell className="text-text-muted">
                      {reward.subjectBadge.subjectOffering.subject.code} · {reward.subjectBadge.subjectOffering.group}
                    </TableCell>
                    <TableCell>{reward.badgeCost}</TableCell>
                    <TableCell>{reward.supply === 0 ? "Ilimitado" : reward.supply}</TableCell>
                    <TableCell>{reward._count.redemptions}</TableCell>
                    <TableCell>
                      <StatusBadge status={reward.active !== false ? "ACTIVE" : "INACTIVE"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}
