import { Skeleton, SkeletonPage } from "@/components/ui";

export default function MainLoading() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <aside className="hidden h-full w-64 shrink-0 border-r border-border-default bg-card lg:block">
        <div className="space-y-3 p-4">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-border-default bg-card p-4">
          <Skeleton className="h-8 w-48" />
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <SkeletonPage cards={6} />
        </main>
      </div>
    </div>
  );
}
