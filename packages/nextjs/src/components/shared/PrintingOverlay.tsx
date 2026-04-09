"use client";

/**
 * PrintingOverlay — Pantalla de simulación de impresión.
 *
 * Se muestra mientras el trabajo de impresión se está procesando.
 * Avanza por 3 pasos con animación cronometrada:
 *   1. "Preparando documento..." (~2s)
 *   2. "Enviando a impresora..." (~2.5s)
 *   3. "Registrando en blockchain..." (~2s)
 *
 * La duración mínima es ~7s para simular el proceso real,
 * pero espera a que el fetch al backend termine antes de redirigir.
 */

import { useEffect, useState, useRef } from "react";
import { ProgressSteps, type ProgressStep } from "@/components/ui/ProgressSteps";
import { icons } from "@/components/ui/icons";

const STEPS: ProgressStep[] = [
  { label: "Preparando documento", icon: icons.print },
  { label: "Enviando a impresora", icon: icons.pending },
  { label: "Registrando en blockchain", icon: icons.token },
];

/** Tiempos en ms que dura cada paso antes de avanzar al siguiente */
const STEP_DURATIONS = [2000, 2500, 2000];

interface PrintingOverlayProps {
  /** Nombre del archivo que se está imprimiendo */
  filename: string;
  /** Promise que resuelve cuando el backend termina (con el logId o null si error) */
  printPromise: Promise<string | null>;
  /** Se llama cuando la animación Y el backend terminan, con el logId */
  onComplete: (logId: string | null) => void;
}

export function PrintingOverlay({ filename, printPromise, onComplete }: PrintingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [animationDone, setAnimationDone] = useState(false);
  const backendResultRef = useRef<string | null | undefined>(undefined);
  const [backendDone, setBackendDone] = useState(false);

  // Avanzar los pasos con los tiempos definidos
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function advanceStep(step: number) {
      if (step >= STEPS.length) {
        setAnimationDone(true);
        return;
      }
      setCurrentStep(step);
      timeout = setTimeout(() => advanceStep(step + 1), STEP_DURATIONS[step]);
    }

    // Empezar desde el paso 0
    advanceStep(0);

    return () => clearTimeout(timeout);
  }, []);

  // Esperar al backend
  useEffect(() => {
    printPromise.then((logId) => {
      backendResultRef.current = logId;
      setBackendDone(true);
    }).catch(() => {
      backendResultRef.current = null;
      setBackendDone(true);
    });
  }, [printPromise]);

  // Cuando ambos terminan, llamar onComplete
  useEffect(() => {
    if (animationDone && backendDone) {
      // Pequeño delay para que se vea el último paso completado
      const timer = setTimeout(() => {
        onComplete(backendResultRef.current ?? null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [animationDone, backendDone, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-10">
      {/* Icono de impresora animado */}
      <div className="relative">
        <div className="grid h-24 w-24 place-items-center rounded-2xl bg-primary/10 text-primary animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect width="12" height="8" x="6" y="14" />
          </svg>
        </div>
      </div>

      {/* Título */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-text">Imprimiendo...</h2>
        <p className="text-sm text-text-muted max-w-xs mx-auto">
          {filename}
        </p>
      </div>

      {/* Pasos de progreso */}
      <ProgressSteps
        steps={STEPS}
        currentStep={currentStep}
        className="w-full max-w-lg"
      />

      {/* Mensaje del paso actual */}
      <p className="text-sm font-medium text-primary animate-pulse">
        {currentStep < STEPS.length ? STEPS[currentStep].label + "..." : "Completado"}
      </p>
    </div>
  );
}
