import { Skeleton, SkeletonTable } from "@/components/ui";

export default function StudentShopOrdersLoading() {
  return (
    <section className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-10 w-56" />
      </div>

      <SkeletonTable columns={5} rows={8} />
    </section>
  );
}
