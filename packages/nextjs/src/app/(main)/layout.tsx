"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StudentOnboardingModal } from "@/components/layout/StudentOnboardingModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { OnboardingProvider, useOnboarding } from "@/contexts/OnboardingContext";
import { useAuthUser } from "@/hooks/useAuthUser";

// Componente interno que necesita acceso al contexto y al usuario
function MainContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthUser();
  const { open } = useOnboarding();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Flag de una sola ejecución: usamos ref (no state) para evitar el render en
  // cascada que ocasionaba setOnboardingTriggered dentro del effect.
  const onboardingTriggeredRef = useRef(false);
  const redirectingRef = useRef(false);

  // Abre el modal automáticamente si el estudiante no ha completado el onboarding
  useEffect(() => {
    if (!loading && user && user.role === "STUDENT" && !user.onboardingCompleted && !onboardingTriggeredRef.current) {
      onboardingTriggeredRef.current = true;
      open();
    }
  }, [loading, user, open]);

  // Sesión huérfana o expirada: cookie con userId apuntando a usuario que ya
  // no existe o está desactivado. /api/auth/me destruye la cookie y devuelve
  // 401 → user queda como null. El middleware no la había bloqueado porque
  // se ejecutó ANTES del destroy. Sin este redirect, el layout se queda en
  // skeleton infinito hasta que el usuario refresca manualmente.
  useEffect(() => {
    if (!loading && !user && !redirectingRef.current) {
      redirectingRef.current = true;
      const returnUrl = encodeURIComponent(pathname || "/");
      router.replace(`/login?returnUrl=${returnUrl}`);
    }
  }, [loading, user, pathname, router]);

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

  const isFirstTime = user.role === "STUDENT" && !user.onboardingCompleted;

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

      {/* Onboarding modal — solo estudiantes */}
      {user.role === "STUDENT" && (
        <StudentOnboardingModal isFirstTime={isFirstTime} />
      )}
    </div>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <MainContent>{children}</MainContent>
    </OnboardingProvider>
  );
}
