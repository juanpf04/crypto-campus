"use client";

/**
 * StudentRewardsInventoryTable — Tabla desplegable con el inventario de
 * recompensas de cada alumno matriculado en un offering.
 *
 * Cada fila es un alumno; al expandirla se ven sus recompensas con 3 contadores:
 *   - canjeadas (total adquirido)
 *   - disponibles (aún no usadas ni solicitadas)
 *   - pendientes (solicitudes de uso en estado PENDING)
 *
 * No hace fetches: recibe los datos ya agregados del padre.
 */

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/Table";
import { icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface InventoryRewardEntry {
  rewardId: string;
  rewardName: string;
  description: string | null;
  category: string;
  badgeCost: number;
  redemptions: number;
  pending: number;
  approved: number;
  available: number;
}

export interface InventoryStudentRow {
  userId: string;
  name: string;
  email: string;
  totalRedemptions: number;
  totalAvailable: number;
  totalPending: number;
  rewards: InventoryRewardEntry[];
}

interface StudentRewardsInventoryTableProps {
  students: InventoryStudentRow[];
}

const COLUMN_COUNT = 6;

export function StudentRewardsInventoryTable({ students }: StudentRewardsInventoryTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(userId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  if (students.length === 0) {
    return (
      <EmptyState
        title="Sin alumnos"
        description="No hay alumnos matriculados en este grupo."
      />
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Alumno</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Canjeadas</TableHead>
            <TableHead>Disponibles</TableHead>
            <TableHead>Pendientes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((s) => {
            const isOpen = expanded.has(s.userId);
            return (
              <StudentInventoryRow
                key={s.userId}
                student={s}
                isOpen={isOpen}
                onToggle={() => toggle(s.userId)}
              />
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

interface StudentInventoryRowProps {
  student: InventoryStudentRow;
  isOpen: boolean;
  onToggle: () => void;
}

function StudentInventoryRow({ student, isOpen, onToggle }: StudentInventoryRowProps) {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell className="w-10 text-text-muted">
          <span
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center transition-transform",
              isOpen && "rotate-90",
            )}
            aria-hidden
          >
            {icons.chevronRight}
          </span>
        </TableCell>
        <TableCell className="font-medium">{student.name}</TableCell>
        <TableCell className="text-text-muted text-sm">{student.email}</TableCell>
        <TableCell>
          <Badge variant={student.totalRedemptions > 0 ? "info" : "neutral"}>
            {student.totalRedemptions}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant={student.totalAvailable > 0 ? "success" : "neutral"}>
            {student.totalAvailable}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant={student.totalPending > 0 ? "warning" : "neutral"}>
            {student.totalPending}
          </Badge>
        </TableCell>
      </TableRow>

      {isOpen && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={COLUMN_COUNT} className="bg-bg/40 p-0">
            <div className="px-4 py-3">
              {student.rewards.length === 0 ? (
                <p className="text-sm text-text-muted italic">
                  Este alumno aún no ha canjeado ninguna recompensa.
                </p>
              ) : (
                <Table className="bg-card">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recompensa</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Canjeadas</TableHead>
                      <TableHead>Disponibles</TableHead>
                      <TableHead>Pendientes</TableHead>
                      <TableHead>Usadas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.rewards.map((r) => (
                      <TableRow key={r.rewardId}>
                        <TableCell>
                          <p className="font-medium text-text">{r.rewardName}</p>
                          {r.description && (
                            <p className="text-xs text-text-muted truncate max-w-[260px]">
                              {r.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="neutral">{r.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="info">{r.redemptions}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.available > 0 ? "success" : "neutral"}>
                            {r.available}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.pending > 0 ? "warning" : "neutral"}>
                            {r.pending}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.approved > 0 ? "neutral" : "neutral"}>
                            {r.approved}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
