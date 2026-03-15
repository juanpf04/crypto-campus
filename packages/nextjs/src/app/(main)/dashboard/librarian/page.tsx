"use client";

/**
 * Dashboard del BIBLIOTECARIO.
 *
 * Secciones basadas en sus funcionalidades del contrato LibraryManager:
 * - Catálogo: libros totales, copias disponibles
 * - Préstamos: solicitudes pendientes, préstamos activos, vencidos
 */

import { useEffect, useState } from "react";
import { StatCard } from "@/components/shared/StatCard";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

interface UserData {
  name: string;
}

/* ── Iconos ── */
const icons = {
  library: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  items: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  loans: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  pending: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  alert: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <h2 className="text-lg font-semibold text-text">{children}</h2>
    </div>
  );
}

export default function LibrarianDashboard() {
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── Saludo ── */}
      <div>
        <h1 className="text-2xl font-bold text-text">
          Bienvenido, {user.name.split(" ")[0]}
        </h1>
        <p className="text-text-muted mt-1">
          Panel de gestión de la biblioteca.
        </p>
      </div>

      {/* ── Sección: Catálogo ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Catálogo</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Libros en catálogo"
            value="—"
            subtitle="Títulos registrados"
            icon={icons.library}
          />
          <StatCard
            title="Copias disponibles"
            value="—"
            subtitle="No prestadas actualmente"
            icon={icons.items}
          />
        </div>
      </section>

      {/* ── Sección: Préstamos ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.loans}>Préstamos</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card compuesta: estados de préstamos */}
          <Card className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icons.loans}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-muted">Estado de préstamos</p>
              <div className="mt-2 flex items-center divide-x divide-border-default">
                <div className="pr-4">
                  <p className="text-xl font-bold text-warning">—</p>
                  <p className="text-xs text-text-muted">Solicitudes</p>
                </div>
                <div className="px-4">
                  <p className="text-xl font-bold text-primary">—</p>
                  <p className="text-xs text-text-muted">Activos</p>
                </div>
                <div className="pl-4">
                  <p className="text-xl font-bold text-danger">—</p>
                  <p className="text-xs text-text-muted">Vencidos</p>
                </div>
              </div>
            </div>
          </Card>

          <StatCard
            title="Devoluciones hoy"
            value="—"
            subtitle="Previstas para hoy"
            icon={icons.pending}
          />
          <StatCard
            title="Préstamos vencidos"
            value="—"
            subtitle="Requieren atención"
            icon={icons.alert}
          />
        </div>
      </section>
    </div>
  );
}
