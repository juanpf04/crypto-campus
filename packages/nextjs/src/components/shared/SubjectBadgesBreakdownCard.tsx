"use client";

/**
 * SubjectBadgesBreakdownCard — Card de cabecera para la vista de recompensas
 * de una asignatura. Muestra el balance actual del alumno en esa asignatura
 * y el desglose agrupado por tarea; cada tarea se puede expandir para ver
 * los premios concretos ganados en ella.
 */

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface PrizeEntry {
  prizeCategoryId: string;
  prizeName: string;
  timesWon: number;
  totalBadges: number;
}

interface AssignmentEntry {
  assignmentId: string;
  assignmentName: string;
  totalBadges: number;
  prizes: PrizeEntry[];
}

interface SubjectBadgesBreakdownCardProps {
  /** Balance actual (ganadas - canjeadas). */
  totalBadges: number;
  /** Total histórico de insignias ganadas. Si es diferente a totalBadges, se muestra el detalle. */
  earnedBadges?: number;
  /** Total de insignias ya canjeadas. */
  burnedBadges?: number;
  breakdown: AssignmentEntry[];
  /** Cuántas tareas mostrar antes de "Ver todas" */
  previewCount?: number;
}

export function SubjectBadgesBreakdownCard({
  totalBadges,
  earnedBadges,
  burnedBadges,
  breakdown,
  previewCount = 3,
}: SubjectBadgesBreakdownCardProps) {
  const [expandedList, setExpandedList] = useState(false);
  const [openAssignments, setOpenAssignments] = useState<Set<string>>(new Set());

  const visible = expandedList ? breakdown : breakdown.slice(0, previewCount);
  const hiddenCount = breakdown.length - previewCount;
  const hasBurnedInfo =
    earnedBadges !== undefined && burnedBadges !== undefined && burnedBadges > 0;

  function toggleAssignment(id: string) {
    setOpenAssignments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {icons.badge}
        </div>
        <div className="flex-1">
          <p className="text-sm text-text-muted">Insignias disponibles en esta asignatura</p>
          <p className="text-3xl font-bold text-text leading-tight">
            {totalBadges}{" "}
            <span className="text-base font-normal text-text-muted">
              insignia{totalBadges !== 1 ? "s" : ""}
            </span>
          </p>
          {hasBurnedInfo && (
            <p className="text-xs text-text-muted mt-1">
              {earnedBadges} ganada{earnedBadges !== 1 ? "s" : ""} · {burnedBadges} canjeada{burnedBadges !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {breakdown.length === 0 ? (
        <p className="text-sm text-text-muted italic">
          Aún no has ganado ninguna insignia en esta asignatura.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-text">Cómo las has conseguido:</p>
          <ul className="space-y-1.5">
            {visible.map((entry) => {
              const isOpen = openAssignments.has(entry.assignmentId);
              return (
                <li
                  key={entry.assignmentId}
                  className="rounded-lg bg-bg border border-border-default overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleAssignment(entry.assignmentId)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-border-default/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={cn(
                          "h-4 w-4 shrink-0 text-text-muted transition-transform",
                          isOpen && "rotate-90",
                        )}
                        aria-hidden="true"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <span className="text-text truncate">{entry.assignmentName}</span>
                      <span className="text-xs text-text-muted shrink-0">
                        · {entry.prizes.length} premio{entry.prizes.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <Badge variant="info">+{entry.totalBadges}</Badge>
                  </button>

                  {isOpen && (
                    <ul className="border-t border-border-default bg-card/50 divide-y divide-border-default">
                      {entry.prizes.map((prize) => (
                        <li
                          key={prize.prizeCategoryId}
                          className="flex items-center justify-between gap-3 px-3 py-2 pl-9 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="text-text truncate">{prize.prizeName}</p>
                            {prize.timesWon > 1 && (
                              <p className="text-text-muted">
                                {prize.timesWon} veces
                              </p>
                            )}
                          </div>
                          <span className="font-medium text-primary shrink-0">
                            +{prize.totalBadges}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpandedList((v) => !v)}
              className="text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              {expandedList ? "Ver menos" : `Ver todas (${breakdown.length})`}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
