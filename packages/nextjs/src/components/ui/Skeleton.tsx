"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-border-default/60",
        className,
      )}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton
          key={idx}
          className={cn(
            "h-3.5",
            idx === lines - 1 ? "w-4/5" : "w-full",
          )}
        />
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border-default bg-card p-4",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      <Skeleton className="h-4 w-2/5" />
      <SkeletonText lines={3} className="mt-4" />
      <Skeleton className="mt-4 h-9 w-1/3" />
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({
  rows = 6,
  columns = 5,
  className,
}: SkeletonTableProps) {
  return (
    <div
      className={cn("rounded-xl border border-border-default bg-card", className)}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="border-b border-border-default p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {Array.from({ length: columns }).map((_, idx) => (
            <Skeleton key={`head-${idx}`} className="h-3.5 w-3/4" />
          ))}
        </div>
      </div>

      <div className="divide-y divide-border-default">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={`row-${rowIdx}`} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-5">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <Skeleton key={`cell-${rowIdx}-${colIdx}`} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface SkeletonPageProps {
  className?: string;
  cards?: number;
}

export function SkeletonPage({ className, cards = 6 }: SkeletonPageProps) {
  return (
    <section
      className={cn("space-y-6", className)}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, idx) => (
          <SkeletonCard key={idx} />
        ))}
      </div>
    </section>
  );
}