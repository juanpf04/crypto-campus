"use client";

/**
 * Dashboard del PROFESOR.
 *
 * Secciones basadas en sus funcionalidades del contrato BadgeSystem:
 * - Insignias: tipos creados, badges otorgados
 * - Tareas: tareas activas, tareas completadas por alumnos
 * - Recompensas: recompensas creadas, solicitudes pendientes de aprobación
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
  badge: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  ),
  task: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  reward: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  students: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  ),
  pending: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
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

export default function ProfessorDashboard() {
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
          Panel de gestión académica.
        </p>
      </div>

      {/* ── Sección: Insignias ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.badge}>Insignias</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Tipos de insignia creados"
            value="—"
            subtitle="Definidos por ti"
            icon={icons.badge}
          />
          <StatCard
            title="Insignias otorgadas"
            value="—"
            subtitle="A alumnos"
            icon={icons.students}
          />
        </div>
      </section>

      {/* ── Sección: Tareas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.task}>Tareas</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Tareas activas"
            value="—"
            subtitle="Disponibles para alumnos"
            icon={icons.task}
          />
          <StatCard
            title="Tareas completadas"
            value="—"
            subtitle="Por alumnos"
            icon={icons.task}
          />
        </div>
      </section>

      {/* ── Sección: Recompensas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.reward}>Recompensas</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Recompensas creadas"
            value="—"
            subtitle="Disponibles para canjear"
            icon={icons.reward}
          />

          {/* Card compuesta: solicitudes de uso de recompensas */}
          <Card className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icons.pending}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-muted">Solicitudes de uso</p>
              <div className="mt-2 flex items-center divide-x divide-border-default">
                <div className="pr-4">
                  <p className="text-xl font-bold text-warning">—</p>
                  <p className="text-xs text-text-muted">Pendientes</p>
                </div>
                <div className="px-4">
                  <p className="text-xl font-bold text-success">—</p>
                  <p className="text-xs text-text-muted">Aprobadas</p>
                </div>
                <div className="pl-4">
                  <p className="text-xl font-bold text-danger">—</p>
                  <p className="text-xs text-text-muted">Rechazadas</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
