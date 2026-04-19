import { Skeleton, SkeletonCard } from "@/components/ui";

export default function StudentLibraryLoading() {
  return (
    <section className="space-y-8" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-7 w-52" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}
