"use client";

/**
 * Lista de todas las recompensas (admin).
 *
 * Tabla con nombre, tipo de insignia, creador, coste, stock, canjes y estado.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

interface Reward {
  id: string;
  name: string;
  badgeCost: number;
  supply: number;
  active: boolean;
  subjectBadge: {
    subjectOffering: { group: string; subject: { name: string; code: string } };
  };
  creator?: { name: string };
  _count: { redemptions: number };
}

export default function AdminRewardsPage() {
  const router = useRouter();
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

  if (loading && rewards.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href="/admin/badges" label="Volver a insignias" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Recompensas</h1>
          <p className="text-text-muted mt-1">{rewards.length} recompensa(s)</p>
        </div>
        <Button onClick={() => router.push("/admin/badges/rewards/new")}>
          Crear recompensa
        </Button>
      </div>

      {rewards.length === 0 ? (
        <EmptyState
          title="Sin recompensas"
          description="Aún no se ha creado ninguna recompensa en la plataforma."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Asignatura</TableHead>
                <TableHead>Creador</TableHead>
                <TableHead>Coste</TableHead>
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
                    {reward.subjectBadge?.subjectOffering
                      ? `${reward.subjectBadge.subjectOffering.subject.code} · ${reward.subjectBadge.subjectOffering.group}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {reward.creator?.name ?? "—"}
                  </TableCell>
                  <TableCell>{reward.badgeCost} insignias</TableCell>
                  <TableCell>
                    {reward.supply === 0 ? "Ilimitado" : reward.supply}
                  </TableCell>
                  <TableCell>{reward._count.redemptions}</TableCell>
                  <TableCell>
                    <StatusBadge status={reward.active ? "ACTIVE" : "INACTIVE"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
