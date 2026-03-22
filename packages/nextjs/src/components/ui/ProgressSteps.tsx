"use client";

/**
 * ProgressSteps — Componente atómico de progreso por pasos.
 *
 * Muestra una barra de progreso con pasos secuenciales, cada uno con
 * icono, label y estado (pendiente, activo, completado).
 *
 * Reutilizable en cualquier flujo multi-paso: impresión, compras,
 * préstamos, registro, etc.
 */

import { useEffect, useState } from "react";

export interface ProgressStep {
  /** Texto descriptivo del paso */
  label: string;
  /** Icono del paso (ReactNode, por ejemplo un SVG) */
  icon?: React.ReactNode;
}

interface ProgressStepsProps {
  /** Lista ordenada de pasos */
  steps: ProgressStep[];
  /** Índice del paso actualmente activo (0-based) */
  currentStep: number;
  /** Clase CSS adicional para el contenedor */
  className?: string;
}

export function ProgressSteps({ steps, currentStep, className }: ProgressStepsProps) {
  // Animación suave: el progreso se actualiza con un pequeño delay
  const [animatedStep, setAnimatedStep] = useState(-1);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedStep(currentStep), 100);
    return () => clearTimeout(timer);
  }, [currentStep]);

  return (
    <div className={className}>
      {/* Barra de progreso */}
      <div className="relative mx-auto mb-8 h-1.5 max-w-md overflow-hidden rounded-full bg-border-default">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-700 ease-out"
          style={{
            width: steps.length > 1
              ? `${(animatedStep / (steps.length - 1)) * 100}%`
              : animatedStep >= 0 ? "100%" : "0%",
          }}
        />
      </div>

      {/* Pasos */}
      <div className="flex items-start justify-center gap-8">
        {steps.map((step, i) => {
          const isCompleted = i < currentStep;
          const isActive = i === currentStep;

          return (
            <div key={i} className="flex flex-col items-center gap-2 min-w-[80px]">
              {/* Icono circular */}
              <div
                className={`
                  grid h-12 w-12 place-items-center rounded-full transition-all duration-500
                  ${isCompleted
                    ? "bg-primary text-white scale-100"
                    : isActive
                      ? "bg-primary/20 text-primary scale-110 ring-4 ring-primary/20"
                      : "bg-border-default text-text-muted scale-90"
                  }
                `}
              >
                {isCompleted ? (
                  // Checkmark para completado
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.icon ?? (
                    <span className="text-sm font-bold">{i + 1}</span>
                  )
                )}
              </div>

              {/* Label */}
              <span
                className={`
                  text-xs font-medium text-center transition-colors duration-300
                  ${isActive ? "text-primary" : isCompleted ? "text-text" : "text-text-muted"}
                `}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
