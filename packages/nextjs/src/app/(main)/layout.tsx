"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthUser } from "@/hooks/useAuthUser";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading || !user) {
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
            <div className="space-y-6" aria-busy="true" aria-live="polite">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-80 max-w-full" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="rounded-xl border border-border-default bg-card p-4">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="mt-4 h-3.5 w-full" />
                    <Skeleton className="mt-2 h-3.5 w-4/5" />
                    <Skeleton className="mt-4 h-9 w-1/3" />
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fijo en desktop, drawer en móvil */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:static lg:z-auto transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <Sidebar name={user.name} role={user.role} />
      </div>

      {/* Contenido principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
