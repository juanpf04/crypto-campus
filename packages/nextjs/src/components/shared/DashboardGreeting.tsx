"use client";

/**
 * Saludo de bienvenida para los dashboards.
 *
 * Muestra "Bienvenido, {primer nombre}" con un subtítulo
 * descriptivo del rol. Se repetía de forma idéntica en los 4 dashboards.
 */

interface DashboardGreetingProps {
  /** Nombre completo del usuario (se extrae el primer nombre) */
  name: string;
  /** Subtítulo descriptivo del panel */
  subtitle: string;
}

export function DashboardGreeting({ name, subtitle }: DashboardGreetingProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-text">
        Bienvenido, {name.split(" ")[0]}
      </h1>
      <p className="text-text-muted mt-1">{subtitle}</p>
    </div>
  );
}
