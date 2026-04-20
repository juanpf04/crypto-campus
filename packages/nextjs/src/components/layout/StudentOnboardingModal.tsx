"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "@/actions/onboarding";
import { useOnboarding } from "@/contexts/OnboardingContext";

// ── Datos de los slides ──────────────────────────────────────────────────────

const MODULES = [
  {
    emoji: "📚",
    title: "Biblioteca",
    description:
      "Solicita préstamos de libros, juegos de mesa y videojuegos. Se requiere un pequeño depósito en LibraryTokens que se devuelve al entregar.",
  },
  {
    emoji: "🚪",
    title: "Salas de estudio",
    description:
      "Reserva salas por franjas de 1 hora, hasta 4 horas al día. Una sala por estudiante al día.",
  },
  {
    emoji: "🖨️",
    title: "Impresión",
    description:
      "Usa tus créditos de impresión en cualquier impresora del campus. Empiezas con 200 créditos (1 crédito = 1 página).",
  },
  {
    emoji: "🏅",
    title: "Insignias",
    description:
      "Tus profesores pueden premiarte con insignias por tus trabajos. Acumúlalas y canjéalas por recompensas académicas.",
  },
  {
    emoji: "🛒",
    title: "Tienda",
    description:
      "Compra merchandising UCM con ShopTokens: bolígrafos, libretas, camisetas, sudaderas y más.",
  },
];

const REWARDS = [
  { action: "Devolver préstamo a tiempo", amount: "2 SHPT" },
  { action: "Devolver con +3 días de antelación", amount: "3 SHPT" },
  { action: "Reservar una sala", amount: "1 SHPT" },
  { action: "Imprimir (por cada 10 páginas)", amount: "1 SHPT" },
  { action: "Recibir una insignia académica", amount: "5 SHPT" },
  { action: "Primer uso de cada módulo", amount: "+2 SHPT" },
];

// ── Slides ───────────────────────────────────────────────────────────────────

function SlideWelcome() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center py-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-5xl">
        🎓
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-bold text-text">Bienvenido a CryptoCampus</h2>
        <p className="text-lg text-text-muted max-w-md">
          La plataforma de servicios universitarios de la UCM
        </p>
      </div>
      <p className="text-sm text-text-muted max-w-lg leading-relaxed">
        Gestiona tus servicios del campus desde un solo lugar: biblioteca, salas de estudio,
        impresión, insignias académicas y tienda. En el fondo usamos blockchain para que
        todo sea transparente y seguro, pero tú no necesitas saber nada de eso.
      </p>
    </div>
  );
}

function SlideModules() {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-text">¿Qué puedes hacer?</h2>
        <p className="text-sm text-text-muted">Cinco módulos, una sola aplicación</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((mod) => (
          <div
            key={mod.title}
            className="flex items-start gap-3 rounded-xl border border-border-default bg-bg p-4"
          >
            <span className="text-2xl shrink-0 mt-0.5">{mod.emoji}</span>
            <div>
              <p className="text-sm font-semibold text-text">{mod.title}</p>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">{mod.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideShopTokens() {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-text">Gana ShopTokens</h2>
        <p className="text-sm text-text-muted">
          Úsalos en la tienda — y recarga con tu tarjeta si necesitas más (10 SHPT = 1&nbsp;€)
        </p>
      </div>

      <div className="rounded-xl border border-border-default overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] bg-card px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
          <span>Acción</span>
          <span className="text-right">Recompensa</span>
        </div>
        {REWARDS.map((r, i) => (
          <div
            key={r.action}
            className={cn(
              "grid grid-cols-[1fr_auto] px-4 py-3 text-sm items-center",
              i % 2 === 0 ? "bg-bg" : "bg-card",
            )}
          >
            <span className="text-text">{r.action}</span>
            <span className="font-semibold text-primary text-right">{r.amount}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-text-muted text-center">
        Empiezas con 0 SHPT. Los bolígrafos cuestan ~12 SHPT, las sudaderas ~280–320 SHPT.
      </p>
    </div>
  );
}

function SlideReady({ onFinish, loading }: { onFinish: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center py-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 text-5xl">
        ✅
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-bold text-text">¡Ya sabes todo lo que necesitas!</h2>
        <p className="text-text-muted max-w-md leading-relaxed">
          Si en algún momento no recuerdas cómo funciona algo, pulsa el botón
          <strong className="text-text"> ¿Cómo funciona?</strong> en el menú lateral para
          volver a ver esta guía.
        </p>
      </div>
      <Button size="lg" onClick={onFinish} loading={loading} className="mt-2 min-w-[220px]">
        Empezar a usar CryptoCampus
      </Button>
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────

const SLIDES = ["Bienvenida", "Módulos", "ShopTokens", "¡Listo!"];

export function StudentOnboardingModal({ isFirstTime }: { isFirstTime: boolean }) {
  const { isOpen, close } = useOnboarding();
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  function handleFinish() {
    startTransition(async () => {
      if (isFirstTime) {
        await completeOnboarding();
      }
      setStep(0);
      close();
    });
  }

  function handleClose() {
    setStep(0);
    close();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border-default bg-card shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header: steps + cerrar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default shrink-0">
          <div className="flex items-center gap-2">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === step ? "w-6 bg-primary" : "w-2 bg-border-default",
                )}
              />
            ))}
          </div>
          <span className="text-xs text-text-muted">
            {step + 1} / {SLIDES.length}
          </span>
          {/* Solo mostrar X si ya completó onboarding (reabriendo desde sidebar) */}
          {!isFirstTime && (
            <button
              onClick={handleClose}
              className="ml-4 rounded-lg p-1.5 text-text-muted hover:bg-border-default/50 hover:text-text transition-colors"
              aria-label="Cerrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                className="h-4 w-4">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Contenido del slide */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === 0 && <SlideWelcome />}
          {step === 1 && <SlideModules />}
          {step === 2 && <SlideShopTokens />}
          {step === 3 && <SlideReady onFinish={handleFinish} loading={isPending} />}
        </div>

        {/* Footer: navegación */}
        {step < 3 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border-default shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              onClick={() => setStep((s) => Math.min(SLIDES.length - 1, s + 1))}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
