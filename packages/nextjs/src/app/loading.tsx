import { SkeletonPage } from "@/components/ui";

export default function RootLoading() {
  return (
    <main className="min-h-screen bg-bg px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <SkeletonPage cards={6} />
      </div>
    </main>
  );
}
