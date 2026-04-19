import { Skeleton, SkeletonCard } from "@/components/ui";

export default function StudentShopLoading() {
  return (
    <section className="space-y-10" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="rounded-xl border border-border-default bg-card p-5 space-y-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-7 w-3/5" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}
