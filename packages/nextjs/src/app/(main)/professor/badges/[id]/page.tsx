"use client";

/**
 * Detalle de un tipo de insignia.
 *
 * Muestra la información del badge type, sus tareas (con opciones
 * de otorgar y desactivar) y sus recompensas asociadas.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/hooks/useToast";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";

interface Task {
  id: string;
  name: string;
  description: string | null;
  rewardAmount: number;
  active: boolean;
  _count?: { awards: number };
}

interface Reward {
  id: string;
  name: string;
  badgeCost: number;
  supply: number;
  _count?: { redemptions: number };
}

interface BadgeTypeDetail {
  id: string;
  name: string;
  description: string | null;
  subjectOffering: {
    id: string;
    subject: { name: string };
    academicYear: string;
  };
  professor: { name: string };
  tasks: Task[];
  rewards: Reward[];
}

export default function ProfessorBadgeTypeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [badgeType, setBadgeType] = useState<BadgeTypeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/badges/types/${id}`);
      if (res.ok) {
        setBadgeType(await res.json());
      } else {
        addToast("Error al cargar tipo de insignia", "danger");
      }
    } catch {
      addToast("Error al cargar tipo de insignia", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleDeactivateTask(taskId: string) {
    setDeactivating(taskId);
    try {
      const res = await fetch(`/api/badges/tasks/${taskId}/deactivate`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al desactivar tarea");
      }
      addToast("Tarea desactivada", "success");
      loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al desactivar tarea", "danger");
    } finally {
      setDeactivating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!badgeType) {
    return (
      <div className="space-y-6">
        <BackLink href="/professor/badges" label="Volver a insignias" />
        <EmptyState title="No encontrado" description="No se encontró el tipo de insignia." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BackLink href="/professor/badges" label="Volver a insignias" />

      {/* ── Información del badge type ── */}
      <div>
        <h1 className="text-2xl font-bold text-text">{badgeType.name}</h1>
        {badgeType.description && (
          <p className="text-text-muted mt-1">{badgeType.description}</p>
        )}
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-text-muted">
          <span>Asignatura: <strong className="text-text">{badgeType.subjectOffering.subject.name}</strong></span>
          <span>Curso: <strong className="text-text">{badgeType.subjectOffering.academicYear}</strong></span>
          <span>Profesor: <strong className="text-text">{badgeType.professor.name}</strong></span>
        </div>
      </div>

      {/* ── Sección: Tareas ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle icon={icons.task}>Tareas</SectionTitle>
          <Link href={`/professor/badges/${id}/tasks/new`}>
            <Button size="sm">Crear tarea</Button>
          </Link>
        </div>

        {badgeType.tasks.length === 0 ? (
          <EmptyState
            title="Sin tareas"
            description="Aún no has creado ninguna tarea para este tipo de insignia."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Otorgamientos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {badgeType.tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell>{task.rewardAmount}</TableCell>
                    <TableCell>{task._count?.awards ?? 0}</TableCell>
                    <TableCell>
                      <StatusBadge status={task.active ? "ACTIVE" : "INACTIVE"} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {task.active && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/professor/badges/${id}/tasks/${task.id}/award`)}
                            >
                              Otorgar
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeactivateTask(task.id)}
                              loading={deactivating === task.id}
                            >
                              Desactivar
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      {/* ── Sección: Recompensas ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle icon={icons.reward}>Recompensas</SectionTitle>
          <Link href="/professor/rewards/new">
            <Button size="sm" variant="secondary">Crear recompensa</Button>
          </Link>
        </div>

        {badgeType.rewards.length === 0 ? (
          <EmptyState
            title="Sin recompensas"
            description="No hay recompensas asociadas a este tipo de insignia."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Coste (badges)</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Canjes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {badgeType.rewards.map((reward) => (
                  <TableRow key={reward.id}>
                    <TableCell className="font-medium">{reward.name}</TableCell>
                    <TableCell>{reward.badgeCost}</TableCell>
                    <TableCell>{reward.supply === 0 ? "Ilimitado" : reward.supply}</TableCell>
                    <TableCell>{reward._count?.redemptions ?? 0}</TableCell>
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
