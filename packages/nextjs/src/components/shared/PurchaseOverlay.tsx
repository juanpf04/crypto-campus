"use client";

/**
 * PurchaseOverlay — Overlay animado que simula el proceso de compra.
 *
 * Muestra una animación multi-paso mientras el backend procesa:
 * compra + entrega automática simulada.
 * Tiene duración mínima (~6s) para dar sensación de proceso real.
 * Cuando terminan AMBOS (animación y backend), llama a onComplete.
 * El padre usa router.replace() para que "atrás" no vuelva aquí.
 */

import { useEffect, useState, useRef } from "react";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { icons } from "@/components/ui/icons";

interface PurchaseOverlayProps {
  /** Nombre del producto que se está comprando */
  productName: string;
  /** Promise del fetch al backend (se resuelve con el batchId o null) */
  purchasePromise: Promise<string | null>;
  /** Callback cuando todo termina (animación + backend) */
  onComplete: (batchId: string | null) => void;
}

const STEPS = [
  { label: "Verificando saldo..." },
  { label: "Procesando pago..." },
  { label: "Preparando pedido..." },
  { label: "¡Pedido completado!" },
];

const STEP_DURATION = 1500;

export function PurchaseOverlay({ productName, purchasePromise, onComplete }: PurchaseOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const backendResult = useRef<string | null>(null);
  const backendDone = useRef(false);
  const animationDone = useRef(false);

  // Avanzar los pasos de la animación
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 1; i < STEPS.length; i++) {
      timers.push(
        setTimeout(() => {
          setCurrentStep(i);
          if (i === STEPS.length - 1) {
            animationDone.current = true;
            if (backendDone.current) {
              setTimeout(() => onComplete(backendResult.current), 800);
            }
          }
        }, STEP_DURATION * i),
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  // Esperar al backend
  useEffect(() => {
    purchasePromise.then((batchId) => {
      backendResult.current = batchId;
      backendDone.current = true;
      if (animationDone.current) {
        setTimeout(() => onComplete(batchId), 800);
      }
    });
  }, [purchasePromise, onComplete]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-8 py-20">
      {/* Icono animado */}
      <div className="grid h-20 w-20 place-items-center rounded-2xl bg-primary/10 text-primary animate-pulse">
        <div className="h-10 w-10">
          {icons.shop}
        </div>
      </div>

      {/* Nombre del producto */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-text">Procesando compra</h2>
        <p className="text-text-muted mt-1">{productName}</p>
      </div>

      {/* Pasos de progreso */}
      <div className="w-full max-w-sm">
        <ProgressSteps steps={STEPS} currentStep={currentStep} />
      </div>
    </div>
  );
}
